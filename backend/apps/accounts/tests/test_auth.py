import pytest


@pytest.mark.django_db
class TestRegister:
    URL = '/api/v1/auth/register/'

    def test_register_success(self, api_client):
        res = api_client.post(self.URL, {
            'phone': '9801234567',
            'full_name': 'Sita Thapa',
            'password': 'securepass123',
            'confirm_password': 'securepass123',
        }, format='json')
        assert res.status_code == 201
        assert 'tokens' in res.data
        assert 'user' in res.data
        assert res.data['user']['phone'] == '9801234567'

    def test_register_invalid_phone(self, api_client):
        res = api_client.post(self.URL, {
            'phone': '1234567890',
            'full_name': 'Test',
            'password': 'securepass123',
            'confirm_password': 'securepass123',
        }, format='json')
        assert res.status_code == 400
        assert 'field_errors' in res.data

    def test_register_password_mismatch(self, api_client):
        res = api_client.post(self.URL, {
            'phone': '9801234567',
            'full_name': 'Test',
            'password': 'securepass123',
            'confirm_password': 'differentpass',
        }, format='json')
        assert res.status_code == 400

    def test_register_duplicate_phone(self, api_client, create_user):
        create_user(phone='9801234567')
        res = api_client.post(self.URL, {
            'phone': '9801234567',
            'full_name': 'Another',
            'password': 'securepass123',
            'confirm_password': 'securepass123',
        }, format='json')
        assert res.status_code == 400

    def test_register_short_password(self, api_client):
        res = api_client.post(self.URL, {
            'phone': '9801234567',
            'full_name': 'Test',
            'password': 'short',
            'confirm_password': 'short',
        }, format='json')
        assert res.status_code == 400


@pytest.mark.django_db
class TestLogin:
    URL = '/api/v1/auth/login/'

    def test_login_success(self, api_client, create_user):
        create_user(phone='9801234567', password='testpass123')
        res = api_client.post(self.URL, {'phone': '9801234567', 'password': 'testpass123'}, format='json')
        assert res.status_code == 200
        assert 'tokens' in res.data
        assert 'access' in res.data['tokens']
        assert 'refresh' in res.data['tokens']

    def test_login_wrong_password(self, api_client, create_user):
        create_user(phone='9801234567', password='testpass123')
        res = api_client.post(self.URL, {'phone': '9801234567', 'password': 'wrongpass'}, format='json')
        assert res.status_code == 400

    def test_login_unknown_phone(self, api_client):
        res = api_client.post(self.URL, {'phone': '9809999999', 'password': 'anypass123'}, format='json')
        assert res.status_code == 400

    def test_login_with_plus977_prefix(self, api_client, create_user):
        create_user(phone='9801234567', password='testpass123')
        res = api_client.post(self.URL, {'phone': '+9779801234567', 'password': 'testpass123'}, format='json')
        assert res.status_code == 200


@pytest.mark.django_db
class TestMe:
    def test_get_profile_authenticated(self, auth_client):
        res = auth_client.get('/api/v1/users/me/')
        assert res.status_code == 200
        assert 'phone' in res.data
        assert 'profile' in res.data

    def test_get_profile_unauthenticated(self, api_client):
        res = api_client.get('/api/v1/users/me/')
        assert res.status_code == 401
