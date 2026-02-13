import os
import json
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv('OPENAI_API_KEY')
print(f"🔑 API Key loaded: {api_key[:20] if api_key else 'NOT FOUND'}...")

if not api_key:
    raise Exception("OPENAI_API_KEY not found in environment variables")

client = OpenAI(api_key=api_key)


def extract_text_from_image(base64_image):
    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": "이 이미지에 있는 독일어 텍스트를 정확히 추출해주세요. 텍스트만 반환하고, 설명은 하지 마세요. 줄바꿈 하이픈(= 또는 -)도 그대로 유지해주세요."
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{base64_image}"
                            }
                        }
                    ]
                }
            ],
            max_tokens=2000
        )
        return response.choices[0].message.content
    except Exception as e:
        raise Exception(f"OCR failed: {str(e)}")


def translate_to_korean(german_text):
    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "system",
                    "content": "당신은 전문 독일어-한국어 번역가입니다. 원문의 뉘앙스와 문학적 표현을 살려 자연스러운 한국어로 번역해주세요."
                },
                {
                    "role": "user",
                    "content": f"다음 독일어 텍스트를 한국어로 번역해주세요:\n\n{german_text}"
                }
            ],
            max_tokens=2000
        )
        return response.choices[0].message.content
    except Exception as e:
        raise Exception(f"Korean translation failed: {str(e)}")


def translate_to_english(german_text):
    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "system",
                    "content": "You are a professional German-English translator. Translate naturally while preserving the nuance of the original text."
                },
                {
                    "role": "user",
                    "content": f"Translate the following German text to English:\n\n{german_text}"
                }
            ],
            max_tokens=2000
        )
        return response.choices[0].message.content
    except Exception as e:
        raise Exception(f"English translation failed: {str(e)}")


def translate_with_sentence_mapping(german_text):
    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "system",
                    "content": """당신은 전문 번역가입니다. 독일어 텍스트를 문장 단위로 분리하고, 각 문장을 한국어와 영어로 번역해주세요.

반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트는 포함하지 마세요:
[
  {
    "de": "독일어 원문 문장",
    "ko": "한국어 번역",
    "en": "영어 번역"
  }
]

규칙:
- 각 문장을 자연스러운 단위로 분리하세요
- 한국어는 자연스럽고 문학적으로 번역하세요
- 영어도 자연스럽게 번역하세요
- 반드시 유효한 JSON 배열로 응답하세요"""
                },
                {
                    "role": "user",
                    "content": f"다음 독일어 텍스트를 문장 단위로 번역해주세요:\n\n{german_text}"
                }
            ],
            max_tokens=4000
        )
        result = response.choices[0].message.content.strip()
        if result.startswith('```json'):
            result = result[7:-3].strip()
        elif result.startswith('```'):
            result = result[3:-3].strip()
        sentences = json.loads(result)
        return sentences
    except Exception as e:
        raise Exception(f"Sentence mapping translation failed: {str(e)}")


def merge_and_translate_pages(previous_german_ending, new_german_text):
    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "system",
                    "content": """당신은 19세기 독일어 서적 전문 번역가입니다.

옛 독일어 책에서는 페이지가 넘어갈 때 단어나 문장이 중간에 끊기는 경우가 많습니다.
- 단어 끊김: "Ein=" 다음 페이지 "druck" → "Eindruck"
- 문장 끊김: 문장이 마침표 없이 끝나고 다음 페이지에서 이어짐

당신의 임무:
1. 이전 페이지 끝부분과 새 페이지 텍스트를 분석합니다
2. 끊긴 단어가 있으면 합칩니다 (= 또는 - 기호로 끊긴 경우)
3. 이전 페이지에서 이어지는 문장이 있으면 새 페이지 시작에 자연스럽게 합칩니다
4. 완성된 새 페이지 텍스트를 문장 단위로 분리하여 번역합니다

반드시 아래 JSON 형식으로만 응답하세요:
{
  "merged_from_previous": "이전 페이지에서 가져온 독일어 텍스트 (없으면 빈 문자열)",
  "clean_german": "정리된 새 페이지 전체 독일어 텍스트",
  "sentences": [
    {
      "de": "독일어 원문 문장",
      "ko": "한국어 번역",
      "en": "영어 번역"
    }
  ]
}

규칙:
- 한국어는 자연스럽고 문학적으로 번역하세요
- 영어도 자연스럽게 번역하세요
- 합쳐진 문장도 자연스럽게 번역하세요
- 반드시 유효한 JSON으로 응답하세요"""
                },
                {
                    "role": "user",
                    "content": f"""이전 페이지 끝부분:
\"\"\"{previous_german_ending}\"\"\"

새 페이지 전체 텍스트:
\"\"\"{new_german_text}\"\"\"

끊긴 단어와 문장을 합치고, 문장 단위로 번역해주세요."""
                }
            ],
            max_tokens=4000
        )
        result = response.choices[0].message.content.strip()
        if result.startswith('```json'):
            result = result[7:-3].strip()
        elif result.startswith('```'):
            result = result[3:-3].strip()
        parsed = json.loads(result)
        return parsed
    except Exception as e:
        raise Exception(f"Merge and translate failed: {str(e)}")


def check_sentence_continuation(previous_text, new_text):
    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "system",
                    "content": "당신은 텍스트 연속성을 판단하는 전문가입니다."
                },
                {
                    "role": "user",
                    "content": f"""다음 두 텍스트를 분석해주세요:

이전 페이지 끝: "{previous_text}"
새 페이지 시작: "{new_text}"

이 두 텍스트가 하나의 문장으로 이어지나요?
JSON 형식으로만 답변해주세요:
{{
  "is_continuation": true/false,
  "merged_text": "이어지는 경우 합친 문장 (한국어)",
  "confidence": 0.0-1.0
}}"""
                }
            ],
            max_tokens=500
        )
        result = response.choices[0].message.content.strip()
        if result.startswith('```json'):
            result = result[7:-3].strip()
        elif result.startswith('```'):
            result = result[3:-3].strip()
        parsed = json.loads(result)
        return parsed
    except Exception as e:
        print(f"Continuation check failed: {str(e)}")
        return {
            "is_continuation": False,
            "merged_text": "",
            "confidence": 0.0
        }