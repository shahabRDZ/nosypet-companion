from django.contrib import admin

from .models import BehaviorEvent, Companion, CompanionMemory, CompanionTrait


@admin.register(Companion)
class CompanionAdmin(admin.ModelAdmin):
    list_display = ("name", "unique_code", "owner", "founder_number", "age_days", "birth_at")
    list_filter = ("species", "is_in_coma", "birth_at")
    search_fields = ("name", "unique_code", "owner__username")
    readonly_fields = ("dna_seed", "unique_code", "birth_at", "parent_username_at_birth")


@admin.register(CompanionTrait)
class CompanionTraitAdmin(admin.ModelAdmin):
    list_display = ("companion", "trait", "value", "updated_at")
    list_filter = ("trait",)


@admin.register(CompanionMemory)
class CompanionMemoryAdmin(admin.ModelAdmin):
    list_display = ("companion", "fact_type", "key", "confidence", "learned_at")
    list_filter = ("fact_type",)
    search_fields = ("companion__name", "key", "value")


@admin.register(BehaviorEvent)
class BehaviorEventAdmin(admin.ModelAdmin):
    list_display = ("companion", "event_type", "created_at")
    list_filter = ("event_type",)
    date_hierarchy = "created_at"
