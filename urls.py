from django.contrib import admin
from django.urls import path
from accounts.views import index, login_view, register_view, consumer_dashboard, admin_dashboard
from bookings.views import book_tanker
from complaints.views import file_complaint

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', index, name='index'),
    path('login/', login_view, name='login'),
    path('register/', register_view, name='register'),
    path('dashboard/', consumer_dashboard, name='consumer_dashboard'),
    path('admin-dashboard/', admin_dashboard, name='admin_dashboard'),
    path('book/', book_tanker, name='book_tanker'),
    path('complaint/', file_complaint, name='file_complaint'),
]