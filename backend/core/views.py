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
from .disease_lists import COMMON_DISEASES, MEDIUM_DISEASES, HARD_DISEASES
import random

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

    def generate_patient(self, difficulty):
        if difficulty == 'easy':
            disease = random.choice(COMMON_DISEASES)
            description_quality = "подробно и точно"
        elif difficulty == 'medium':
            disease = random.choice(COMMON_DISEASES + MEDIUM_DISEASES)
            description_quality = "достаточно точно, но может упустить некоторые детали"
        else:  # hard
            disease = random.choice(COMMON_DISEASES + MEDIUM_DISEASES + HARD_DISEASES)
            description_quality = "неточно, может путаться в описаниях и жаловаться на не связанные с болезнью симптомы"

        prompt = f"""Создайте данные виртуального пациента с заболеванием: {disease}.
        Пациент должен описывать свои симптомы {description_quality}.
        Включите следующую информацию:
        1. Имя
        2. Возраст
        3. Пол
        4. Основные жалобы
        5. История болезни
        6. Дополнительная информация

        Также создайте предварительные ответы пациента на следующие вопросы:
        1. Опишите свои симптомы
        2. Как долго у вас эти симптомы?
        3. Есть ли у вас какие-либо аллергии или хронические заболевания?
        4. Принимаете ли вы какие-либо лекарства?
        5. Опишите свой внешний вид
        6. Что вы чувствуете при касании или давлении в области дискомфорта?

        Верните данные в формате JSON с двумя ключами: 'patient_data' и 'patient_responses'."""

        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": prompt},
            ],
        )

        return json.loads(response.choices[0].message.content)

    def create(self, request, *args, **kwargs):
        difficulty = request.data.get('difficulty', 'easy')
        generated_data = self.generate_patient(difficulty)

        chat = Chat.objects.create(
            doctor=request.user,
            patient_data=json.dumps(generated_data['patient_data']),
            patient_responses=json.dumps(generated_data['patient_responses']),
            difficulty=difficulty
        )

        serializer = self.get_serializer(chat)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def get_patient_response(self, chat, doctor_message):
        patient_data = json.loads(chat.patient_data)
        patient_responses = json.loads(chat.patient_responses)
        difficulty = chat.difficulty

        if difficulty == 'easy':
            response_style = "Отвечайте точно и подробно на вопросы врача."
        elif difficulty == 'medium':
            response_style = "Отвечайте достаточно точно, но можете иногда упускать некоторые детали или немного путаться."
        else:  # hard
            response_style = "Отвечайте неточно, путайтесь в описаниях и иногда жалуйтесь на симптомы, не связанные с вашим основным заболеванием."

        prompt = f"""Вы - виртуальный пациент со следующими данными:
        {json.dumps(patient_data, indent=2)}

        У вас есть следующие предварительно подготовленные ответы:
        {json.dumps(patient_responses, indent=2)}

        {response_style}

        Вопрос врача: {doctor_message}

        Если вопрос врача соответствует одному из предварительно подготовленных ответов, используйте его как основу, но адаптируйте под конкретный вопрос. Если вопрос новый, ответьте на него, исходя из данных пациента и стиля ответа.

        Ответьте на вопрос врача от лица пациента."""

        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": prompt},
            ],
        )

        return response.choices[0].message.content

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

        prompt = f"""Вы - медицинский эксперт. Оцените диагноз и подход врача на основе фактического состояния пациента и истории разговора.
        
        Данные пациента: {json.dumps(patient_data, indent=2)}
        
        История разговора:
        {conversation_history}
        
        Окончательный диагноз врача: {doctor_answer}

        Предоставьте вашу оценку в следующем формате:
        Правильный диагноз: [Фактический правильный диагноз]
        Оценка: [Число от 1 до 5000]
        Обратная связь: [Ваш подробный отзыв и комментарии о подходе врача и диагнозе]

        При выставлении оценки учитывайте следующие факторы:
        1. Точность диагноза (до 2000 баллов)
        2. Качество сбора информации о симптомах (до 1000 баллов)
        3. Вопросы о внешнем виде пациента (до 500 баллов)
        4. Вопросы о тактильных ощущениях и реакции на давление (до 500 баллов)
        5. Общий подход и логика рассуждений (до 1000 баллов)

        5000 баллов - идеальный результат, 1 - полностью неверный подход и диагноз.
        В обратной связи прокомментируйте, насколько хорошо врач собирал информацию, задавал релевантные вопросы, в том числе о внешнем виде и тактильных ощущениях, и пришел к своему заключению.
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
            if line.startswith("Правильный диагноз:")
        )
        score_line = next(
            line for line in evaluation.split("\n") if line.startswith("Оценка:")
        )
        feedback_lines = [
            line for line in evaluation.split("\n") if line.startswith("Обратная связь:")
        ]

        correct_diagnosis = correct_diagnosis_line.split(":", 1)[1].strip()
        score = int(score_line.split(":")[1].strip())
        feedback = "\n".join(feedback_lines).split(":", 1)[1].strip()

        return {
            "correct_diagnosis": correct_diagnosis,
            "score": score,
            "feedback": feedback,
        }
