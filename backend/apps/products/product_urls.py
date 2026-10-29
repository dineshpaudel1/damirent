from django.urls import path
from .views import (
    AvailabilityDetailView,
    AvailabilityView,
    MyListingsView,
    ProductDetailView,
    ProductImageView,
    ProductListCreateView,
)

urlpatterns = [
    path('', ProductListCreateView.as_view(), name='product-list-create'),
    path('my-listings/', MyListingsView.as_view(), name='product-my-listings'),
    path('<uuid:pk>/', ProductDetailView.as_view(), name='product-detail'),
    path('<uuid:pk>/images/', ProductImageView.as_view(), name='product-images'),
    path('<uuid:pk>/images/<uuid:image_id>/', ProductImageView.as_view(), name='product-image-detail'),
    path('<uuid:pk>/availability/', AvailabilityView.as_view(), name='product-availability'),
    path('<uuid:pk>/availability/<uuid:block_id>/', AvailabilityDetailView.as_view(), name='product-availability-detail'),
]
