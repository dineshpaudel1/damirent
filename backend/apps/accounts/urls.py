from django.urls import path
from . import views

# Auth routes — mounted at /api/v1/auth/
urlpatterns = [
    path('register/', views.RegisterView.as_view(), name='auth-register'),
    path('login/', views.LoginView.as_view(), name='auth-login'),
    path('logout/', views.LogoutView.as_view(), name='auth-logout'),
    path('token/refresh/', views.TokenRefreshView.as_view(), name='auth-token-refresh'),
    path('otp/send/', views.SendOTPView.as_view(), name='auth-otp-send'),
    path('otp/verify/', views.VerifyOTPView.as_view(), name='auth-otp-verify'),
    path('password/reset/', views.PasswordResetInitiateView.as_view(), name='auth-password-reset'),
    path('password/reset/confirm/', views.PasswordResetConfirmView.as_view(), name='auth-password-reset-confirm'),
]
