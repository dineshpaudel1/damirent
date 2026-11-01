import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from rest_framework_simplejwt.tokens import AccessToken
from django.contrib.auth import get_user_model

User = get_user_model()


class NotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        token = self._extract_token()
        user = await self._authenticate(token)

        if user is None:
            await self.close(code=4001)
            return

        self.user = user
        self.group_name = f'user_{user.id}_notifications'

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        # Client-to-server messages are not used; this is push-only
        pass

    async def notification_push(self, event):
        """Relay a notification.push channel-layer event to the WebSocket client."""
        await self.send(text_data=json.dumps(event['notification']))

    def _extract_token(self) -> str:
        qs = self.scope.get('query_string', b'').decode()
        for part in qs.split('&'):
            if '=' in part:
                k, v = part.split('=', 1)
                if k == 'token':
                    return v
        return ''

    @database_sync_to_async
    def _authenticate(self, token: str):
        try:
            validated = AccessToken(token)
            return User.objects.get(id=validated['user_id'])
        except Exception:
            return None
