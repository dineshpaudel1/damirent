from django.urls import path
from .views import (
    PaymentInitiateView, KhaltiCallbackView, PaymentStatusView,
    PenaltyPaymentInitiateView, PenaltyKhaltiCallbackView,
)

urlpatterns = [
    path('initiate/', PaymentInitiateView.as_view(), name='payment-initiate'),
    path('khalti-callback/', KhaltiCallbackView.as_view(), name='khalti-callback'),
    path('<uuid:booking_id>/', PaymentStatusView.as_view(), name='payment-status'),
    path('penalty/<uuid:penalty_id>/initiate/', PenaltyPaymentInitiateView.as_view(), name='penalty-payment-initiate'),
    path('penalty-callback/', PenaltyKhaltiCallbackView.as_view(), name='penalty-khalti-callback'),
]
