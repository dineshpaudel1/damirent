from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.bookings.models import Booking
from services.notification_service import create_notification
from .models import Review
from .serializers import ReviewSerializer, ReviewCreateSerializer


class ReviewListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        product_id = request.query_params.get('product')
        if not product_id:
            return Response(
                {'error': 'product query parameter is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        qs = (
            Review.objects
            .filter(product_id=product_id)
            .select_related('reviewer', 'reviewer__profile')
            .order_by('-created_at')
        )
        return Response(ReviewSerializer(qs, many=True).data)

    def post(self, request):
        serializer = ReviewCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        booking = get_object_or_404(
            Booking.objects.select_related('renter', 'owner', 'product'),
            pk=serializer.validated_data['booking'],
        )

        # Only completed bookings can be reviewed
        if booking.status != 'completed':
            return Response(
                {'error': 'Reviews can only be submitted for completed bookings.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Determine role
        if request.user == booking.renter:
            review_type = 'renter_reviewing_owner'
            reviewee = booking.owner
        elif request.user == booking.owner:
            review_type = 'owner_reviewing_renter'
            reviewee = booking.renter
        else:
            return Response({'error': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Enforce one review per party per booking (unique_together guard)
        if Review.objects.filter(booking=booking, reviewer=request.user).exists():
            return Response(
                {'error': 'You have already reviewed this booking.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        review = Review.objects.create(
            booking=booking,
            reviewer=request.user,
            reviewee=reviewee,
            product=booking.product,
            rating=serializer.validated_data['rating'],
            comment=serializer.validated_data.get('comment', ''),
            review_type=review_type,
        )

        # Notify the reviewee
        create_notification(
            user=reviewee,
            notif_type='review_received',
            title='New Review',
            body=f'{request.user.full_name} left you a {review.rating}★ review.',
            data={'booking_id': str(booking.id), 'screen': 'booking_detail'},
        )

        return Response(ReviewSerializer(review).data, status=status.HTTP_201_CREATED)
