"""Iteration 2 regression tests: cipher/suggest, video messages, improved restaurant realism."""
import time
import uuid
import pytest
import requests

from conftest import API


# ----- Cipher suggest endpoint -----
class TestCipherSuggest:
    def _make_conv(self, alice, bob):
        r = requests.post(f'{API}/conversations', headers=alice['headers'],
                          json={'type': 'dm', 'member_ids': [bob['user']['id']]})
        assert r.status_code == 200, r.text
        return r.json()['id']

    def _clean(self, alice, conv_id):
        requests.delete(f'{API}/conversations/{conv_id}', headers=alice['headers'])

    def test_suggest_meeting_true(self, alice, bob):
        conv_id = self._make_conv(alice, bob)
        try:
            msgs = [
                (alice, 'can we sync tomorrow?'),
                (bob, 'yeah i am free tue 4pm'),
                (alice, 'perfect lets hop on a call'),
            ]
            for user, content in msgs:
                r = requests.post(f'{API}/conversations/{conv_id}/messages',
                                  headers=user['headers'],
                                  json={'content': content, 'type': 'text'})
                assert r.status_code == 200, r.text

            r = requests.post(f'{API}/cipher/suggest', headers=alice['headers'],
                              json={'conversation_id': conv_id}, timeout=60)
            assert r.status_code == 200, r.text
            d = r.json()
            assert 'should_suggest' in d and 'reason' in d and 'prompt' in d
            assert d['should_suggest'] is True, f'Expected True, got {d}'
            assert isinstance(d['prompt'], str) and len(d['prompt']) > 0
        finally:
            self._clean(alice, conv_id)

    def test_suggest_no_meeting_false(self, alice, bob):
        conv_id = self._make_conv(alice, bob)
        try:
            for user, content in [(alice, 'hello'), (bob, 'hi there')]:
                r = requests.post(f'{API}/conversations/{conv_id}/messages',
                                  headers=user['headers'],
                                  json={'content': content, 'type': 'text'})
                assert r.status_code == 200

            r = requests.post(f'{API}/cipher/suggest', headers=alice['headers'],
                              json={'conversation_id': conv_id}, timeout=60)
            assert r.status_code == 200, r.text
            d = r.json()
            assert d['should_suggest'] is False, f'Expected False for casual hello, got {d}'
        finally:
            self._clean(alice, conv_id)

    def test_suggest_too_few_messages(self, alice, bob):
        conv_id = self._make_conv(alice, bob)
        try:
            r = requests.post(f'{API}/cipher/suggest', headers=alice['headers'],
                              json={'conversation_id': conv_id}, timeout=30)
            assert r.status_code == 200
            d = r.json()
            assert d['should_suggest'] is False
        finally:
            self._clean(alice, conv_id)

    def test_suggest_non_member_forbidden(self, alice, bob, cara):
        conv_id = self._make_conv(alice, bob)
        try:
            r = requests.post(f'{API}/cipher/suggest', headers=cara['headers'],
                              json={'conversation_id': conv_id}, timeout=30)
            assert r.status_code == 403
        finally:
            self._clean(alice, conv_id)


# ----- Video message support -----
class TestVideoMessage:
    def test_send_video_message(self, alice, bob):
        r = requests.post(f'{API}/conversations', headers=alice['headers'],
                          json={'type': 'dm', 'member_ids': [bob['user']['id']]})
        conv_id = r.json()['id']
        try:
            # Fake small mp4 base64 data URL
            fake_mp4_b64 = 'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDE='
            payload = {
                'content': '',
                'type': 'video',
                'media_b64': fake_mp4_b64,
                'media_name': 'TEST_clip.mp4',
                'media_size': 52,
            }
            r2 = requests.post(f'{API}/conversations/{conv_id}/messages',
                               headers=alice['headers'], json=payload)
            assert r2.status_code == 200, r2.text
            msg = r2.json()
            assert msg['type'] == 'video'
            assert msg['media_b64'] == fake_mp4_b64
            assert msg['media_name'] == 'TEST_clip.mp4'
            msg_id = msg['id']

            # GET list to confirm persistence
            r3 = requests.get(f'{API}/conversations/{conv_id}/messages', headers=alice['headers'])
            assert r3.status_code == 200
            found = next((m for m in r3.json() if m['id'] == msg_id), None)
            assert found is not None
            assert found['type'] == 'video'
            assert found['media_b64'] == fake_mp4_b64
        finally:
            requests.delete(f'{API}/conversations/{conv_id}', headers=alice['headers'])

    def test_send_audio_message(self, alice, bob):
        r = requests.post(f'{API}/conversations', headers=alice['headers'],
                          json={'type': 'dm', 'member_ids': [bob['user']['id']]})
        conv_id = r.json()['id']
        try:
            fake_m4a = 'data:audio/m4a;base64,AAAAGGZ0eXBtNGEgAAAAAG00YSBpc29t'
            r2 = requests.post(f'{API}/conversations/{conv_id}/messages',
                               headers=alice['headers'],
                               json={'content': '', 'type': 'audio', 'media_b64': fake_m4a,
                                     'media_name': 'TEST_voice.m4a', 'media_size': 40})
            assert r2.status_code == 200, r2.text
            m = r2.json()
            assert m['type'] == 'audio'
            assert m['media_b64'] == fake_m4a
        finally:
            requests.delete(f'{API}/conversations/{conv_id}', headers=alice['headers'])


# ----- Improved Cipher realism (Unsplash images) -----
class TestCipherRealism:
    def test_restaurant_card_unsplash_image(self, alice):
        r = requests.post(f'{API}/cipher/ask', headers=alice['headers'],
                          json={'prompt': 'Find an Italian restaurant for 4 near Connaught Place Delhi'},
                          timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        if d.get('fallback'):
            pytest.skip('LLM fallback mode, skip realism check')
        assert d['intent'] in ('restaurant', 'general')
        rest_cards = [c for c in d.get('cards', []) if c.get('type') == 'restaurant']
        assert rest_cards, f'No restaurant cards: {d}'
        for c in rest_cards:
            assert 'image_url' in c and c['image_url']
            assert c['image_url'].startswith('https://images.unsplash.com'), \
                f"image_url should be unsplash, got {c['image_url']}"

    def test_weather_card_valid(self, alice):
        r = requests.post(f'{API}/cipher/ask', headers=alice['headers'],
                          json={'prompt': "What's the weather in Delhi tomorrow?"},
                          timeout=60)
        assert r.status_code == 200
        d = r.json()
        if d.get('fallback'):
            pytest.skip('LLM fallback')
        assert d['intent'] in ('weather', 'general')

    def test_calendar_card_valid(self, alice):
        r = requests.post(f'{API}/cipher/ask', headers=alice['headers'],
                          json={'prompt': 'Schedule 30 min sync Tue 4pm with the group'},
                          timeout=60)
        assert r.status_code == 200
        d = r.json()
        if d.get('fallback'):
            pytest.skip('LLM fallback')
        assert 'intent' in d and 'summary' in d and 'cards' in d
