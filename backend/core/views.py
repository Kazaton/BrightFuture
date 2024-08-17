from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import Chat, Message
from .serializers import ChatSerializer, MessageSerializer
from openai import OpenAI
import os
from dotenv import load_dotenv, find_dotenv
import logging
import json

logger = logging.getLogger(__name__)

load_dotenv(find_dotenv())

client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))


class ChatViewSet(viewsets.ModelViewSet):
    queryset = Chat.objects.all()
    serializer_class = ChatSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        patient_data = self.generate_patient()
        serializer.save(doctor=self.request.user, patient_data=json.dumps(patient_data))

    def create(self, request, *args, **kwargs):
        logger.info(f"Starting new chat session. User: {request.user}")

        # Генерация виртуального пациента с помощью ChatGPT
        patient_data = self.generate_patient()

        chat = Chat.objects.create(
            doctor=request.user, patient_data=json.dumps(patient_data)
        )

        serializer = self.get_serializer(chat)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def send_message(self, request, pk=None):
        chat = self.get_object()
        content = request.data.get("content")

        if chat.doctor != request.user:
            return Response(
                {"error": "You are not authorized to send messages in this chat"},
                status=status.HTTP_403_FORBIDDEN,
            )

        patient_response = self.get_patient_response(chat, content)

        Message.objects.create(chat=chat, sender="doctor", content=content)
        patient_message = Message.objects.create(
            chat=chat, sender="patient", content=patient_response
        )

        return Response(MessageSerializer(patient_message).data)

    @action(detail=True, methods=["post"])
    def end_game(self, request, pk=None):
        chat = self.get_object()
        answer = request.data.get("answer")

        if chat.doctor != request.user:
            return Response(
                {"error": "You are not authorized to end this game"},
                status=status.HTTP_403_FORBIDDEN,
            )

        if chat.is_finished:
            return Response(
                {"error": "This game has already ended"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        evaluation = self.evaluate_answer(chat, answer)

        chat.diagnosis = answer
        chat.score = evaluation["score"]
        chat.feedback = evaluation["feedback"]
        chat.is_finished = True
        chat.save()

        return Response(evaluation)

    def evaluate_answer(self, chat, doctor_answer):
        patient_data = json.loads(chat.patient_data)
        messages = Message.objects.filter(chat=chat).order_by("timestamp")

        conversation_history = "\n".join(
            [f"{msg.sender}: {msg.content}" for msg in messages]
        )

        prompt = f"""You are a medical expert. Evaluate the doctor's diagnosis and approach based on the patient's actual condition and the conversation history.
        
        Patient data: {json.dumps(patient_data, indent=2)}
        
        Conversation history:
        {conversation_history}
        
        Doctor's final diagnosis: {doctor_answer}

        Provide your evaluation in the following format:
        Correct Diagnosis: [The actual correct diagnosis]
        Score: [A number between 1 and 5000]
        Feedback: [Your detailed feedback and comments on the doctor's approach and diagnosis]

        Base the score on the accuracy of the diagnosis and the quality of the doctor's approach during the conversation, with 5000 being perfect and 1 being completely incorrect.
        In the feedback, comment on how well the doctor gathered information, asked relevant questions, and came to their conclusion.
        """

        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": prompt},
            ],
        )

        evaluation = response.choices[0].message.content
        correct_diagnosis_line = next(
            line
            for line in evaluation.split("\n")
            if line.startswith("Correct Diagnosis:")
        )
        score_line = next(
            line for line in evaluation.split("\n") if line.startswith("Score:")
        )
        feedback_lines = [
            line for line in evaluation.split("\n") if line.startswith("Feedback:")
        ]

        correct_diagnosis = correct_diagnosis_line.split(":", 1)[1].strip()
        score = int(score_line.split(":")[1].strip())
        feedback = "\n".join(feedback_lines).split(":", 1)[1].strip()

        return {
            "correct_diagnosis": correct_diagnosis,
            "score": score,
            "feedback": feedback,
        }
