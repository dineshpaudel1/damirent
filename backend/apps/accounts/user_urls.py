from django.urls import path
from . import views

# User routes — mounted at /api/v1/users/
app_name = 'users'

urlpatterns = [
    # Current user
    path('me/', views.MeView.as_view(), name='me'),
    path('me/photo/', views.ProfilePhotoView.as_view(), name='profile-photo'),
    path('me/identity/', views.IdentityVerificationView.as_view(), name='identity-verification'),
    path('me/identity/document/<str:side>/', views.IdentityDocumentView.as_view(), name='identity-document'),

    # Push notifications
    path('push-token/', views.PushTokenView.as_view(), name='push-token'),

    # Public profile
    path('<uuid:id>/', views.PublicProfileView.as_view(), name='public-profile'),

    # ── Verification admin (paudeldinesh961@gmail.com only) ────────────────────
    # NOTE: In production, configure nginx to deny direct access to /media/identities/
    # so that identity documents are only served through these authenticated endpoints.
    path('verification/pending/', views.VerificationDashboardView.as_view(), name='verification-pending'),
    path('verification/<uuid:user_id>/<str:action>/', views.VerificationActionView.as_view(), name='verification-action'),
    path('verification/<uuid:user_id>/document/<str:side>/', views.AdminDocumentView.as_view(), name='admin-identity-document'),
]
