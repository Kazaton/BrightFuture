from django.db import models
from users.models import CustomUser


class Chat(models.Model):
    doctor = models.ForeignKey("users.CustomUser", on_delete=models.CASCADE)
    patient_data = models.TextField()
    start_time = models.DateTimeField(auto_now_add=True)
    end_time = models.DateTimeField(null=True, blank=True)
    diagnosis = models.CharField(max_length=100, null=True, blank=True)
    score = models.IntegerField(null=True, blank=True)
    feedback = models.TextField(null=True, blank=True)
    is_finished = models.BooleanField(default=False)


class Message(models.Model):
    chat = models.ForeignKey(Chat, on_delete=models.CASCADE, related_name="messages")
    sender = models.CharField(max_length=10)
    content = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)
