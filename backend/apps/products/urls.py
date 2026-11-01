from django.urls import path
from .views import CategoryListCreateView, CategoryDetailView

urlpatterns = [
    path('', CategoryListCreateView.as_view(), name='category-list'),
    path('<uuid:pk>/', CategoryDetailView.as_view(), name='category-detail'),
]
