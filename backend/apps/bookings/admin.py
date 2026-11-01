from django.contrib import admin
from .models import Booking, BookingStatusHistory, CancellationPenalty


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ['id', 'product', 'renter', 'owner', 'status', 'total_charged', 'created_at']
    list_filter = ['status']
    search_fields = ['renter__email', 'owner__email', 'product__title']
    readonly_fields = ['id', 'created_at', 'updated_at']


@admin.register(BookingStatusHistory)
class BookingStatusHistoryAdmin(admin.ModelAdmin):
    list_display = ['booking', 'from_status', 'status', 'changed_by', 'created_at']
    readonly_fields = ['id', 'created_at']


@admin.register(CancellationPenalty)
class CancellationPenaltyAdmin(admin.ModelAdmin):
    list_display = ['id', 'booking', 'user', 'amount', 'status', 'created_at', 'paid_at']
    list_filter = ['status']
    search_fields = ['user__email', 'booking__id']
    readonly_fields = ['id', 'created_at', 'paid_at', 'gateway_txn_id']
