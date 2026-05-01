import os
import pytest
import requests
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).resolve().parents[2] / 'frontend' / '.env')

BASE_URL = (os.environ.get('EXPO_PUBLIC_BACKEND_URL') or os.environ.get('EXPO_BACKEND_URL') or '').rstrip('/')
assert BASE_URL, 'EXPO_PUBLIC_BACKEND_URL must be set in frontend/.env'
API = BASE_URL + '/api'

TEST_USERS = {
    'alice': {'email': 'alice@cipherlink.app', 'password': 'Test1234'},
    'bob': {'email': 'bob@cipherlink.app', 'password': 'Test1234'},
    'cara': {'email': 'cara@cipherlink.app', 'password': 'Test1234'},
    'dan': {'email': 'dan@cipherlink.app', 'password': 'Test1234'},
}


@pytest.fixture(scope='session')
def api_url():
    return API


@pytest.fixture(scope='session')
def session():
    s = requests.Session()
    s.headers.update({'Content-Type': 'application/json'})
    return s


def _login(s, email, password):
    r = s.post(f'{API}/auth/login', json={'email': email, 'password': password})
    if r.status_code != 200:
        # Try register if not exists (in case seed is missing)
        r2 = s.post(f'{API}/auth/register', json={'email': email, 'password': password, 'name': email.split('@')[0].title()})
        if r2.status_code in (200, 201):
            return r2.json()
        pytest.skip(f'Cannot authenticate {email}: login {r.status_code} register {r2.status_code}')
    return r.json()


@pytest.fixture(scope='session')
def alice(session):
    data = _login(session, TEST_USERS['alice']['email'], TEST_USERS['alice']['password'])
    return {'token': data['token'], 'user': data['user'], 'headers': {'Authorization': f"Bearer {data['token']}", 'Content-Type': 'application/json'}}


@pytest.fixture(scope='session')
def bob(session):
    data = _login(session, TEST_USERS['bob']['email'], TEST_USERS['bob']['password'])
    return {'token': data['token'], 'user': data['user'], 'headers': {'Authorization': f"Bearer {data['token']}", 'Content-Type': 'application/json'}}


@pytest.fixture(scope='session')
def cara(session):
    data = _login(session, TEST_USERS['cara']['email'], TEST_USERS['cara']['password'])
    return {'token': data['token'], 'user': data['user'], 'headers': {'Authorization': f"Bearer {data['token']}", 'Content-Type': 'application/json'}}


@pytest.fixture(scope='session')
def dan(session):
    data = _login(session, TEST_USERS['dan']['email'], TEST_USERS['dan']['password'])
    return {'token': data['token'], 'user': data['user'], 'headers': {'Authorization': f"Bearer {data['token']}", 'Content-Type': 'application/json'}}
