from django.utils.text import slugify
from rest_framework import serializers

from apps.accounts.models import UserProfile
from .models import AvailabilityBlock, Category, Product, ProductImage


class CategorySerializer(serializers.ModelSerializer):
    children = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ['id', 'name', 'slug', 'icon_name', 'sort_order', 'parent', 'children']

    def get_children(self, obj):
        return CategorySerializer(obj.children.all(), many=True).data


class CategoryWriteSerializer(serializers.ModelSerializer):
    slug = serializers.SlugField(required=False, allow_blank=True)

    class Meta:
        model = Category
        fields = ['name', 'slug', 'icon_name', 'sort_order', 'parent']

    def validate(self, data):
        name = data.get('name') or (self.instance.name if self.instance else '')
        slug = data.get('slug') or slugify(name)

        qs = Category.objects.filter(slug=slug)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError({'slug': f'A category with slug "{slug}" already exists.'})

        data['slug'] = slug
        return data


class PublicUserProfileSerializer(serializers.ModelSerializer):
    avatar = serializers.CharField(source='profile_photo_url', default=None)
    avg_owner_rating = serializers.DecimalField(
        source='avg_rating_as_owner', max_digits=3, decimal_places=2
    )
    total_listings = serializers.SerializerMethodField()

    class Meta:
        model = UserProfile
        fields = ['avatar', 'avg_owner_rating', 'total_listings']

    def get_total_listings(self, obj):
        return obj.user.products.filter(is_active=True).count()


class PublicUserSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    full_name = serializers.CharField()
    is_verified = serializers.BooleanField()
    profile = serializers.SerializerMethodField()

    def get_profile(self, obj):
        try:
            return PublicUserProfileSerializer(obj.profile).data
        except UserProfile.DoesNotExist:
            return {'avatar': None, 'avg_owner_rating': '0.00', 'total_listings': 0}


class ProductImageSerializer(serializers.ModelSerializer):
    image = serializers.CharField(source='image_url')
    order = serializers.IntegerField(source='sort_order')

    class Meta:
        model = ProductImage
        fields = ['id', 'image', 'is_primary', 'order']


class ProductSerializer(serializers.ModelSerializer):
    owner = PublicUserSerializer(read_only=True)
    category = CategorySerializer(read_only=True)
    images = ProductImageSerializer(many=True, read_only=True)
    is_published = serializers.BooleanField(source='is_active')
    is_available = serializers.BooleanField(source='is_active')
    avg_rating = serializers.SerializerMethodField()
    review_count = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            'id', 'owner', 'category', 'title', 'description', 'condition',
            'price_per_day', 'security_deposit', 'min_rental_days', 'max_rental_days',
            'pickup_location', 'latitude', 'longitude',
            'is_published', 'is_available', 'images',
            'avg_rating', 'review_count', 'created_at',
        ]

    def get_avg_rating(self, obj):
        from django.db.models import Avg
        from apps.reviews.models import Review
        avg = Review.objects.filter(product=obj).aggregate(avg=Avg('rating'))['avg']
        return f'{avg:.2f}' if avg else '0.00'

    def get_review_count(self, obj):
        from apps.reviews.models import Review
        return Review.objects.filter(product=obj).count()


class ProductWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = [
            'category', 'title', 'description', 'condition',
            'price_per_day', 'security_deposit', 'min_rental_days', 'max_rental_days',
            'pickup_location', 'latitude', 'longitude',
        ]


class ProductImageUploadSerializer(serializers.Serializer):
    image = serializers.FileField()
    is_primary = serializers.BooleanField(default=False)


class AvailabilityBlockSerializer(serializers.ModelSerializer):
    class Meta:
        model = AvailabilityBlock
        fields = ['id', 'start_date', 'end_date', 'block_type']
        read_only_fields = ['id']
