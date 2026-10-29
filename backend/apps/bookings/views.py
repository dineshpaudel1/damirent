from datetime import date

from django.conf import settings
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.products.models import AvailabilityBlock, Product
from .models import Booking, BookingStatusHistory, ALLOWED_TRANSITIONS
from .serializers import BookingSerializer, BookingCreateSerializer, BookingStatusHistorySerializer


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

        # Check for overlapping availability blocks
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

        # Calculate financials
        total_days = (end_date - start_date).days
        rental_total = total_days * product.price_per_day
        platform_fee = int(rental_total * settings.PLATFORM_FEE_PERCENT / 100)
        security_deposit = product.security_deposit
        total_charged = rental_total + platform_fee + security_deposit

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

        # Hold the dates
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
        return Response(BookingSerializer(booking).data)


class BookingCancelView(APIView):
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

        err = _record_transition(booking, new_status, request.user, note=reason)
        if err:
            return err
        booking.refresh_from_db()
        return Response(BookingSerializer(booking).data)


class BookingActivateView(APIView):
    """Owner confirms the item has been handed over to the renter (confirmed → active)."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        booking = get_object_or_404(Booking, pk=pk, owner=request.user)
        err = _record_transition(booking, 'active', request.user, note='Item handed over to renter')
        if err:
            return err
        booking.refresh_from_db()
        return Response(BookingSerializer(booking).data)


class BookingConfirmReturnView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        booking = get_object_or_404(Booking, pk=pk, owner=request.user)
        err = _record_transition(booking, 'completed', request.user)
        if err:
            return err
        booking.refresh_from_db()
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
        return Response(BookingSerializer(booking).data)
