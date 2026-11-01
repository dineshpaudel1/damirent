from django.conf import settings
from django.core.files.storage import default_storage
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.generics import ListAPIView, ListCreateAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated

ALLOWED_PRODUCT_IMAGE_TYPES = {
    'image/jpeg', 'image/jpg', 'image/png',
    'image/webp', 'image/heic', 'image/heif',
}
MAX_PRODUCT_IMAGE_BYTES = 10 * 1024 * 1024   # 10 MB
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import IdentityVerification
from .models import AvailabilityBlock, Category, Product, ProductImage
from .serializers import (
    AvailabilityBlockSerializer,
    CategorySerializer,
    CategoryWriteSerializer,
    ProductImageUploadSerializer,
    ProductSerializer,
    ProductWriteSerializer,
)


class CategoryListCreateView(ListCreateAPIView):
    pagination_class = None

    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsAdminUser()]

    def get_serializer_class(self):
        return CategorySerializer

    def get_queryset(self):
        return Category.objects.filter(parent__isnull=True).prefetch_related('children')

    def create(self, request, *args, **kwargs):
        serializer = CategoryWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        category = serializer.save()
        return Response(CategorySerializer(category).data, status=status.HTTP_201_CREATED)


class CategoryDetailView(RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAdminUser]
    queryset = Category.objects.prefetch_related('children')

    def get_serializer_class(self):
        return CategoryWriteSerializer

    def retrieve(self, request, *args, **kwargs):
        return Response(CategorySerializer(self.get_object()).data)

    def update(self, request, *args, **kwargs):
        category = self.get_object()
        serializer = CategoryWriteSerializer(category, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        category.refresh_from_db()
        return Response(CategorySerializer(category).data)

    def destroy(self, request, *args, **kwargs):
        category = self.get_object()
        if category.products.exists():
            return Response(
                {'error': 'Cannot delete a category that has active products.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        category.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ProductListCreateView(ListCreateAPIView):
    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsAuthenticated()]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return ProductWriteSerializer
        return ProductSerializer

    def get_queryset(self):
        qs = Product.objects.filter(is_active=True).select_related(
            'owner', 'owner__profile', 'category'
        ).prefetch_related('images')

        search = self.request.query_params.get('search')
        category = self.request.query_params.get('category')
        min_price = self.request.query_params.get('min_price')
        max_price = self.request.query_params.get('max_price')
        condition = self.request.query_params.get('condition')

        owner = self.request.query_params.get('owner')
        if search:
            qs = qs.filter(Q(title__icontains=search) | Q(description__icontains=search))
        if category:
            qs = qs.filter(category__slug=category)
        if min_price:
            qs = qs.filter(price_per_day__gte=int(min_price))
        if max_price:
            qs = qs.filter(price_per_day__lte=int(max_price))
        if condition:
            qs = qs.filter(condition=condition)
        if owner:
            qs = qs.filter(owner__id=owner)

        return qs.order_by('-created_at')

    def create(self, request, *args, **kwargs):
        # Only identity-verified users may publish listings.
        try:
            iv = request.user.identity_verification
            verified = iv.verification_status == IdentityVerification.VERIFIED
        except IdentityVerification.DoesNotExist:
            verified = False

        if not verified:
            return Response(
                {'error': 'You must complete identity verification before publishing a listing. Visit your profile to submit documents for review.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = ProductWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        product = serializer.save(owner=request.user)
        return Response(ProductSerializer(product).data, status=status.HTTP_201_CREATED)


class ProductDetailView(RetrieveUpdateDestroyAPIView):
    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsAuthenticated()]

    def get_serializer_class(self):
        return ProductWriteSerializer

    def get_queryset(self):
        return Product.objects.select_related(
            'owner', 'owner__profile', 'category'
        ).prefetch_related('images')

    def retrieve(self, request, *args, **kwargs):
        product = self.get_object()
        return Response(ProductSerializer(product).data)

    def update(self, request, *args, **kwargs):
        product = self.get_object()
        if product.owner != request.user:
            return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        serializer = ProductWriteSerializer(product, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        product.refresh_from_db()
        return Response(ProductSerializer(product).data)

    def destroy(self, request, *args, **kwargs):
        product = self.get_object()
        if product.owner != request.user:
            return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        product.is_active = False
        product.save(update_fields=['is_active'])
        return Response(status=status.HTTP_204_NO_CONTENT)


class MyListingsView(ListAPIView):
    serializer_class = ProductSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        return Product.objects.filter(owner=self.request.user).select_related(
            'owner', 'owner__profile', 'category'
        ).prefetch_related('images').order_by('-created_at')


class ProductImageView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        product = get_object_or_404(Product, pk=pk, owner=request.user)
        serializer = ProductImageUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        image_file = serializer.validated_data['image']
        is_primary = serializer.validated_data['is_primary']

        if image_file.content_type not in ALLOWED_PRODUCT_IMAGE_TYPES:
            return Response(
                {'error': 'Unsupported image format. Allowed: JPEG, PNG, WebP, HEIC.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if image_file.size > MAX_PRODUCT_IMAGE_BYTES:
            return Response(
                {'error': 'Image must be under 10 MB.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        path = default_storage.save(f'products/{pk}/{image_file.name}', image_file)
        image_url = request.build_absolute_uri(settings.MEDIA_URL + path)

        if is_primary:
            product.images.filter(is_primary=True).update(is_primary=False)

        img = ProductImage.objects.create(
            product=product,
            image_url=image_url,
            is_primary=is_primary,
            sort_order=product.images.count(),
        )
        return Response(
            {'id': str(img.id), 'image': image_url, 'is_primary': img.is_primary, 'order': img.sort_order},
            status=status.HTTP_201_CREATED,
        )

    def delete(self, request, pk, image_id):
        product = get_object_or_404(Product, pk=pk, owner=request.user)
        image = get_object_or_404(ProductImage, pk=image_id, product=product)
        image.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class AvailabilityView(APIView):
    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsAuthenticated()]

    def get(self, request, pk):
        product = get_object_or_404(Product, pk=pk)
        blocks = AvailabilityBlock.objects.filter(product=product)
        return Response(AvailabilityBlockSerializer(blocks, many=True).data)

    def post(self, request, pk):
        product = get_object_or_404(Product, pk=pk, owner=request.user)
        serializer = AvailabilityBlockSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        block = serializer.save(product=product)
        return Response(AvailabilityBlockSerializer(block).data, status=status.HTTP_201_CREATED)


class AvailabilityDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk, block_id):
        product = get_object_or_404(Product, pk=pk, owner=request.user)
        block = get_object_or_404(
            AvailabilityBlock, pk=block_id, product=product, block_type='owner_blocked'
        )
        block.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
