from django.urls import path
from .views import PaymentInitiateView, KhaltiCallbackView, PaymentStatusView

urlpatterns = [
    path('initiate/', PaymentInitiateView.as_view(), name='payment-initiate'),
    path('khalti-callback/', KhaltiCallbackView.as_view(), name='khalti-callback'),
    path('<uuid:booking_id>/', PaymentStatusView.as_view(), name='payment-status'),
]
