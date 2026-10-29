from django.urls import path
from .views import (
    BookingListCreateView,
    BookingDetailView,
    BookingHistoryView,
    BookingApproveView,
    BookingRejectView,
    BookingCancelView,
    BookingActivateView,
    BookingConfirmReturnView,
    BookingDisputeView,
)

urlpatterns = [
    path('', BookingListCreateView.as_view(), name='booking-list-create'),
    path('<uuid:pk>/', BookingDetailView.as_view(), name='booking-detail'),
    path('<uuid:pk>/history/', BookingHistoryView.as_view(), name='booking-history'),
    path('<uuid:pk>/approve/', BookingApproveView.as_view(), name='booking-approve'),
    path('<uuid:pk>/reject/', BookingRejectView.as_view(), name='booking-reject'),
    path('<uuid:pk>/cancel/', BookingCancelView.as_view(), name='booking-cancel'),
    path('<uuid:pk>/activate/', BookingActivateView.as_view(), name='booking-activate'),
    path('<uuid:pk>/confirm-return/', BookingConfirmReturnView.as_view(), name='booking-confirm-return'),
    path('<uuid:pk>/dispute/', BookingDisputeView.as_view(), name='booking-dispute'),
]
