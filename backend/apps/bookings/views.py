from datetime import date

from django.conf import settings
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import IdentityVerification
from apps.products.models import AvailabilityBlock, Product
from services.notification_service import (
    notify_booking_request,
    notify_booking_approved,
    notify_booking_rejected,
    notify_booking_cancelled_to_owner,
    notify_booking_cancelled_to_renter,
    notify_booking_active,
    notify_booking_completed,
    notify_booking_disputed,
)
from .models import (
    Booking, BookingStatusHistory, CancellationPenalty,
    ALLOWED_TRANSITIONS, FREE_CANCELLATION_WINDOW_MINUTES, CANCELLATION_PENALTY_PERCENT,
)
from .serializers import (
    BookingSerializer, BookingCreateSerializer, BookingStatusHistorySerializer,
    CancellationPenaltySerializer,
)


def _record_transition(booking, new_status, changed_by, note=''):
    """Validate and apply a status transition, recording history."""
    if not booking.can_transition_to(new_status):
        return Response(
            {'error': f'Cannot move from "{booking.status}" to "{new_status}".'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    from_status = booking.status
    booking.status = new_status
    booking.save(update_fields=['status', 'updated_at'])

    BookingStatusHistory.objects.create(
        booking=booking,
        from_status=from_status,
        status=new_status,
        changed_by=changed_by,
        note=note,
    )

    # Release the availability hold on cancellation / expiry
    if new_status in ('cancelled_by_renter', 'cancelled_by_owner', 'expired'):
        AvailabilityBlock.objects.filter(booking=booking).delete()

    return None  # no error


class BookingListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        role = request.query_params.get('role', 'renter')
        if role == 'owner':
            qs = Booking.objects.filter(owner=request.user)
        else:
            qs = Booking.objects.filter(renter=request.user)

        qs = qs.select_related(
            'product', 'product__owner', 'product__owner__profile',
            'product__category', 'renter', 'renter__profile',
        ).prefetch_related('product__images').order_by('-created_at')

        from rest_framework.pagination import PageNumberPagination
        paginator = PageNumberPagination()
        paginator.page_size = 20
        page = paginator.paginate_queryset(qs, request)
        serializer = BookingSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    def post(self, request):
        # ── Check 1: Identity verification ───────────────────────────────────
        try:
            iv = request.user.identity_verification
            iv_status = iv.verification_status
        except IdentityVerification.DoesNotExist:
            iv_status = IdentityVerification.NOT_SUBMITTED

        if iv_status != IdentityVerification.VERIFIED:
            detail = {
                IdentityVerification.NOT_SUBMITTED: 'You must complete identity verification before booking. Visit your profile to submit documents for review.',
                IdentityVerification.PENDING: 'Your identity verification is pending admin approval. You can book products once your account has been verified.',
                IdentityVerification.REJECTED: 'Your identity verification was rejected. Please review the feedback, update your documents, and resubmit.',
            }.get(iv_status, 'Identity verification required.')
            return Response(
                {'error': detail, 'verification_status': iv_status},
                status=status.HTTP_403_FORBIDDEN,
            )

        # ── Check 2: Outstanding cancellation penalties ───────────────────────
        outstanding = CancellationPenalty.objects.filter(
            user=request.user,
            status=CancellationPenalty.STATUS_PENDING,
        ).select_related('booking', 'booking__product').first()
        if outstanding:
            return Response(
                {
                    'error': (
                        f'You cannot make a new booking because you have an outstanding '
                        f'cancellation penalty of NPR {outstanding.amount}. '
                        f'Please clear the pending amount before booking another product.'
                    ),
                    'penalty_id': str(outstanding.id),
                    'penalty_amount': outstanding.amount,
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = BookingCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        product_id = serializer.validated_data['product']
        start_date = serializer.validated_data['start_date']
        end_date = serializer.validated_data['end_date']
        message = serializer.validated_data.get('message', '')

        product = get_object_or_404(Product, pk=product_id, is_active=True)

        if product.owner == request.user:
            return Response({'error': 'You cannot book your own item.'}, status=status.HTTP_400_BAD_REQUEST)

        if start_date < date.today():
            return Response({'error': 'Start date cannot be in the past.'}, status=status.HTTP_400_BAD_REQUEST)

        # Calculate financials before entering the critical section
        total_days = (end_date - start_date).days
        if total_days < 1:
            return Response({'error': 'End date must be after start date.'}, status=status.HTTP_400_BAD_REQUEST)

        if product.min_rental_days and total_days < product.min_rental_days:
            return Response(
                {'error': f'Minimum rental duration for this item is {product.min_rental_days} day(s).'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if product.max_rental_days and total_days > product.max_rental_days:
            return Response(
                {'error': f'Maximum rental duration for this item is {product.max_rental_days} day(s).'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        rental_total = total_days * product.price_per_day
        platform_fee = int(rental_total * settings.PLATFORM_FEE_PERCENT / 100)
        security_deposit = product.security_deposit
        total_charged = rental_total + platform_fee + security_deposit

        # Atomic section: re-check availability with a row lock to prevent double-booking
        with transaction.atomic():
            # Lock all existing blocks for this product so concurrent requests
            # cannot both pass the overlap check simultaneously.
            AvailabilityBlock.objects.select_for_update().filter(product=product)

            overlap = AvailabilityBlock.objects.filter(
                product=product,
                start_date__lt=end_date,
                end_date__gt=start_date,
            ).exists()
            if overlap:
                return Response(
                    {'error': 'Product is not available for the selected dates.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            booking = Booking.objects.create(
                product=product,
                renter=request.user,
                owner=product.owner,
                start_date=start_date,
                end_date=end_date,
                total_days=total_days,
                rental_total=rental_total,
                platform_fee=platform_fee,
                security_deposit=security_deposit,
                total_charged=total_charged,
                renter_message=message,
                status='pending_approval',
            )

            # Hold the dates immediately inside the same transaction
            AvailabilityBlock.objects.create(
                product=product,
                start_date=start_date,
                end_date=end_date,
                block_type='booking_hold',
                booking=booking,
            )

            # Initial history
            BookingStatusHistory.objects.create(
                booking=booking,
                from_status=None,
                status='pending_approval',
                changed_by=request.user,
            )

        booking.refresh_from_db()
        notify_booking_request(booking)
        return Response(
            BookingSerializer(booking).data,
            status=status.HTTP_201_CREATED,
        )


class BookingDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_booking(self, pk, user):
        booking = get_object_or_404(
            Booking.objects.select_related(
                'product', 'product__owner', 'product__owner__profile',
                'product__category', 'renter', 'renter__profile',
            ).prefetch_related('product__images'),
            pk=pk,
        )
        if booking.renter != user and booking.owner != user:
            return None, Response({'error': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        return booking, None

    def get(self, request, pk):
        booking, err = self._get_booking(pk, request.user)
        if err:
            return err
        return Response(BookingSerializer(booking).data)


class BookingHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        booking = get_object_or_404(Booking, pk=pk)
        if booking.renter != request.user and booking.owner != request.user:
            return Response({'error': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        history = booking.status_history.select_related('changed_by', 'changed_by__profile').all()
        return Response(BookingStatusHistorySerializer(history, many=True).data)


class BookingApproveView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        booking = get_object_or_404(Booking, pk=pk, owner=request.user)
        err = _record_transition(booking, 'approved', request.user)
        if err:
            return err
        booking.refresh_from_db()
        notify_booking_approved(booking)
        return Response(BookingSerializer(booking).data)


class BookingRejectView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        booking = get_object_or_404(Booking, pk=pk, owner=request.user)
        note = request.data.get('note', '')
        err = _record_transition(booking, 'cancelled_by_owner', request.user, note=note)
        if err:
            return err
        booking.refresh_from_db()
        notify_booking_rejected(booking)
        return Response(BookingSerializer(booking).data)


class BookingCancelView(APIView):
    """
    Cancel a booking.

    Renter cancellations after the FREE_CANCELLATION_WINDOW_MINUTES grace period
    incur a penalty of CANCELLATION_PENALTY_PERCENT % of rental_total.
    The penalty is stored in CancellationPenalty and must be paid before the
    renter can create another booking.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        booking = get_object_or_404(Booking, pk=pk)
        reason = request.data.get('reason', '')

        if booking.renter == request.user:
            new_status = 'cancelled_by_renter'
        elif booking.owner == request.user:
            new_status = 'cancelled_by_owner'
        else:
            return Response({'error': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Pre-calculate penalty for renter cancellations (uses immutable created_at)
        penalty_amount = 0
        if new_status == 'cancelled_by_renter':
            elapsed_minutes = (timezone.now() - booking.created_at).total_seconds() / 60
            if elapsed_minutes > FREE_CANCELLATION_WINDOW_MINUTES:
                penalty_amount = booking.rental_total * CANCELLATION_PENALTY_PERCENT // 100

        with transaction.atomic():
            # Lock the booking row to prevent concurrent cancellations
            booking_locked = Booking.objects.select_for_update().get(pk=pk)

            err = _record_transition(booking_locked, new_status, request.user, note=reason)
            if err:
                return err

            # Idempotent: create penalty only if none exists for this booking
            if penalty_amount > 0:
                CancellationPenalty.objects.get_or_create(
                    booking=booking_locked,
                    defaults={
                        'user': request.user,
                        'amount': penalty_amount,
                        'status': CancellationPenalty.STATUS_PENDING,
                    },
                )

        booking_locked.refresh_from_db()
        if new_status == 'cancelled_by_renter':
            notify_booking_cancelled_to_owner(booking_locked)
        elif new_status == 'cancelled_by_owner':
            notify_booking_cancelled_to_renter(booking_locked)
        return Response(BookingSerializer(booking_locked).data)


class BookingActivateView(APIView):
    """Owner confirms the item has been handed over to the renter (confirmed → active)."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        booking = get_object_or_404(Booking, pk=pk, owner=request.user)
        err = _record_transition(booking, 'active', request.user, note='Item handed over to renter')
        if err:
            return err
        booking.refresh_from_db()
        notify_booking_active(booking)
        return Response(BookingSerializer(booking).data)


class BookingConfirmReturnView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        booking = get_object_or_404(Booking, pk=pk, owner=request.user)
        err = _record_transition(booking, 'completed', request.user)
        if err:
            return err
        booking.refresh_from_db()
        notify_booking_completed(booking)
        return Response(BookingSerializer(booking).data)


class BookingDisputeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        booking = get_object_or_404(Booking, pk=pk)
        if booking.renter != request.user and booking.owner != request.user:
            return Response({'error': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        reason = request.data.get('reason', '')
        err = _record_transition(booking, 'disputed', request.user, note=reason)
        if err:
            return err
        booking.refresh_from_db()
        notify_booking_disputed(booking, filed_by=request.user)
        return Response(BookingSerializer(booking).data)


class CancellationPenaltyListView(APIView):
    """List the current user's cancellation penalties."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        penalties = (
            CancellationPenalty.objects
            .filter(user=request.user)
            .select_related('booking', 'booking__product')
            .order_by('-created_at')
        )
        return Response(CancellationPenaltySerializer(penalties, many=True).data)
