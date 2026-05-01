"""CipherLink backend regression tests covering all critical APIs."""
import time
import uuid
import pyotp
import pytest
import requests

from conftest import API


# ----- Health -----
class TestHealth:
    def test_health_root(self):
        r = requests.get(f'{API}/')
        assert r.status_code == 200
        d = r.json()
        assert d.get('ok') is True
        assert d.get('app') == 'CipherLink'


# ----- Auth -----
class TestAuth:
    def test_register_new_user(self):
        email = f'TEST_{uuid.uuid4().hex[:8]}@cipherlink.app'
        r = requests.post(f'{API}/auth/register', json={'email': email, 'password': 'Test1234', 'name': 'Test User'})
        assert r.status_code == 200, r.text
        d = r.json()
        assert 'token' in d and 'user' in d
        assert d['user']['email'] == email
        # cleanup
        requests.delete(f'{API}/users/me', headers={'Authorization': f"Bearer {d['token']}"})

    def test_register_duplicate(self, alice):
        r = requests.post(f'{API}/auth/register', json={'email': 'alice@cipherlink.app', 'password': 'Test1234', 'name': 'Alice'})
        assert r.status_code == 409

    def test_login_success(self, alice):
        assert alice['user']['email'] == 'alice@cipherlink.app'
        assert 'token' in alice

    def test_login_invalid(self):
        r = requests.post(f'{API}/auth/login', json={'email': 'alice@cipherlink.app', 'password': 'wrong'})
        assert r.status_code == 401

    def test_me(self, alice):
        r = requests.get(f'{API}/auth/me', headers=alice['headers'])
        assert r.status_code == 200
        assert r.json()['email'] == 'alice@cipherlink.app'

    def test_me_no_token(self):
        r = requests.get(f'{API}/auth/me')
        assert r.status_code == 401


# ----- Users -----
class TestUsers:
    def test_user_search_empty(self, alice):
        r = requests.get(f'{API}/users/search', headers=alice['headers'])
        assert r.status_code == 200
        users = r.json()
        assert isinstance(users, list)
        assert all(u['id'] != alice['user']['id'] for u in users)

    def test_user_search_query(self, alice):
        r = requests.get(f'{API}/users/search?q=bob', headers=alice['headers'])
        assert r.status_code == 200
        users = r.json()
        assert any('bob' in u['email'] for u in users)

    def test_patch_me(self, alice):
        r = requests.patch(f'{API}/users/me', headers=alice['headers'], json={'bio': 'hello cipherlink'})
        assert r.status_code == 200
        assert r.json()['bio'] == 'hello cipherlink'
        # GET to verify persistence
        r2 = requests.get(f'{API}/auth/me', headers=alice['headers'])
        assert r2.json()['bio'] == 'hello cipherlink'


# ----- Conversations & Messages -----
class TestConversationsMessages:
    def test_create_dm_and_send_message(self, alice, bob):
        r = requests.post(f'{API}/conversations', headers=alice['headers'], json={'type': 'dm', 'member_ids': [bob['user']['id']]})
        assert r.status_code == 200, r.text
        conv = r.json()
        assert conv['type'] == 'dm'
        assert len(conv['members']) == 2
        conv_id = conv['id']

        # send message
        r2 = requests.post(f"{API}/conversations/{conv_id}/messages", headers=alice['headers'], json={'content': 'TEST_hello bob', 'type': 'text'})
        assert r2.status_code == 200, r2.text
        msg = r2.json()
        assert msg['content'] == 'TEST_hello bob'
        assert msg['sender']['id'] == alice['user']['id']
        msg_id = msg['id']

        # list messages
        r3 = requests.get(f"{API}/conversations/{conv_id}/messages", headers=alice['headers'])
        assert r3.status_code == 200
        msgs = r3.json()
        assert any(m['id'] == msg_id for m in msgs)

        # edit message
        r4 = requests.patch(f"{API}/messages/{msg_id}", headers=alice['headers'], json={'content': 'TEST_edited'})
        assert r4.status_code == 200
        assert r4.json()['content'] == 'TEST_edited'
        assert r4.json()['edited'] is True

        # react
        r5 = requests.post(f"{API}/messages/{msg_id}/react", headers=bob['headers'], json={'emoji': '👍'})
        assert r5.status_code == 200
        assert '👍' in r5.json()['reactions']

        # read-all (bob marks read)
        r6 = requests.post(f"{API}/conversations/{conv_id}/read-all", headers=bob['headers'])
        assert r6.status_code == 200

        # delete message
        r7 = requests.delete(f"{API}/messages/{msg_id}", headers=alice['headers'])
        assert r7.status_code == 200

        # cleanup conv
        requests.delete(f"{API}/conversations/{conv_id}", headers=alice['headers'])

    def test_list_conversations(self, alice):
        r = requests.get(f'{API}/conversations', headers=alice['headers'])
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_group(self, alice, bob, cara):
        r = requests.post(f'{API}/conversations', headers=alice['headers'],
                          json={'type': 'group', 'name': 'TEST_Group', 'member_ids': [bob['user']['id'], cara['user']['id']]})
        assert r.status_code == 200, r.text
        c = r.json()
        assert c['type'] == 'group'
        assert c['name'] == 'TEST_Group'
        assert len(c['members']) == 3
        # GET verify
        r2 = requests.get(f"{API}/conversations/{c['id']}", headers=alice['headers'])
        assert r2.status_code == 200
        # cleanup
        requests.delete(f"{API}/conversations/{c['id']}", headers=alice['headers'])

    def test_dm_dedup(self, alice, bob):
        r1 = requests.post(f'{API}/conversations', headers=alice['headers'], json={'type': 'dm', 'member_ids': [bob['user']['id']]})
        r2 = requests.post(f'{API}/conversations', headers=alice['headers'], json={'type': 'dm', 'member_ids': [bob['user']['id']]})
        assert r1.status_code == 200 and r2.status_code == 200
        assert r1.json()['id'] == r2.json()['id']

    def test_non_member_forbidden(self, alice, bob, cara):
        r = requests.post(f'{API}/conversations', headers=alice['headers'], json={'type': 'dm', 'member_ids': [bob['user']['id']]})
        conv_id = r.json()['id']
        r2 = requests.get(f"{API}/conversations/{conv_id}/messages", headers=cara['headers'])
        assert r2.status_code == 403


# ----- Cipher AI -----
class TestCipherAI:
    def test_cipher_restaurant(self, alice):
        r = requests.post(f'{API}/cipher/ask', headers=alice['headers'],
                          json={'prompt': 'Find an Italian restaurant for 4 near Connaught Place'}, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert 'intent' in d and 'summary' in d and 'cards' in d
        # If LLM responded properly intent should match
        if not d.get('fallback'):
            assert d['intent'] in ('restaurant', 'general')

    def test_cipher_weather(self, alice):
        r = requests.post(f'{API}/cipher/ask', headers=alice['headers'],
                          json={'prompt': "What's the weather in Delhi tomorrow?"}, timeout=60)
        assert r.status_code == 200
        d = r.json()
        assert 'intent' in d

    def test_cipher_calendar(self, alice):
        r = requests.post(f'{API}/cipher/ask', headers=alice['headers'],
                          json={'prompt': 'Schedule sprint retro Mon 10 AM with this group'}, timeout=60)
        assert r.status_code == 200
        d = r.json()
        assert 'intent' in d

    def test_cipher_followup(self, alice):
        # use stable conversation id for context
        cid = 'TEST_session_followup'
        r1 = requests.post(f'{API}/cipher/ask', headers=alice['headers'],
                           json={'prompt': 'Find an Italian restaurant for 4 near Connaught Place', 'conversation_id': cid}, timeout=60)
        assert r1.status_code == 200
        r2 = requests.post(f'{API}/cipher/ask', headers=alice['headers'],
                           json={'prompt': 'A cheaper option?', 'conversation_id': cid}, timeout=60)
        assert r2.status_code == 200
        assert 'summary' in r2.json()


# ----- Search -----
class TestSearch:
    def test_search_all(self, alice):
        r = requests.get(f'{API}/search?q=test&type=all', headers=alice['headers'])
        assert r.status_code == 200
        d = r.json()
        assert 'messages' in d and 'contacts' in d and 'ai' in d

    def test_search_contacts(self, alice):
        r = requests.get(f'{API}/search?q=bob&type=contacts', headers=alice['headers'])
        assert r.status_code == 200
        assert any('bob' in u['email'] for u in r.json()['contacts'])

    def test_search_empty_q(self, alice):
        r = requests.get(f'{API}/search?q=&type=all', headers=alice['headers'])
        assert r.status_code == 200
        d = r.json()
        assert d['messages'] == [] and d['contacts'] == [] and d['ai'] == []


# ----- 2FA -----
class TestTFA:
    def test_setup_and_verify(self, alice):
        r = requests.post(f'{API}/2fa/setup', headers=alice['headers'])
        assert r.status_code == 200
        d = r.json()
        assert d['secret'] and d['qr_b64'].startswith('data:image/png;base64,') and 'otpauth' in d['otpauth_url']
        secret = d['secret']
        code = pyotp.TOTP(secret).now()
        r2 = requests.post(f'{API}/2fa/verify', headers=alice['headers'], json={'code': code, 'secret': secret})
        assert r2.status_code == 200, r2.text
        # disable for cleanup
        requests.delete(f'{API}/2fa', headers=alice['headers'])

    def test_verify_invalid(self, alice):
        r = requests.post(f'{API}/2fa/setup', headers=alice['headers'])
        secret = r.json()['secret']
        r2 = requests.post(f'{API}/2fa/verify', headers=alice['headers'], json={'code': '000000', 'secret': secret})
        assert r2.status_code == 400


# ----- GDPR delete -----
class TestGDPRDelete:
    def test_delete_user_wipes_data(self):
        email = f'TEST_gdpr_{uuid.uuid4().hex[:6]}@cipherlink.app'
        r = requests.post(f'{API}/auth/register', json={'email': email, 'password': 'Test1234', 'name': 'GDPR Test'})
        assert r.status_code == 200
        token = r.json()['token']
        h = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
        r2 = requests.delete(f'{API}/users/me', headers=h)
        assert r2.status_code == 200
        # subsequent /me must fail
        r3 = requests.get(f'{API}/auth/me', headers=h)
        assert r3.status_code == 401
