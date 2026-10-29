import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def create_user(db):
    def _create(email='testuser@example.com', full_name='Test User', password='testpass123', **kwargs):
        from apps.accounts.models import UserProfile
        user = User.objects.create_user(
            email=email, full_name=full_name, password=password, **kwargs
        )
        UserProfile.objects.get_or_create(user=user)
        return user
    return _create


@pytest.fixture
def auth_client(api_client, create_user):
    user = create_user()
    token = RefreshToken.for_user(user)
    api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(token.access_token)}')
    api_client.user = user
    return api_client


@pytest.fixture
def create_category(db):
    def _create(name='Electronics', slug='electronics'):
        from apps.products.models import Category
        return Category.objects.create(name=name, slug=slug)
    return _create


@pytest.fixture
def create_product(db, create_user, create_category):
    def _create(owner=None, **kwargs):
        from apps.products.models import Product
        if owner is None:
            owner = create_user(email='owner@example.com', full_name='Owner User')
        category = create_category()
        defaults = {
            'title': 'Test Camera',
            'description': 'A great camera for rent.',
            'condition': 'good',
            'price_per_day': 500,
            'security_deposit': 2000,
            'pickup_location': 'Thamel, Kathmandu',
        }
        defaults.update(kwargs)
        return Product.objects.create(owner=owner, category=category, **defaults)
    return _create
