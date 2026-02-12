import os
from openai import OpenAI
from dotenv import load_dotenv

# .env 파일 명시적으로 로드
load_dotenv()

# API 키 가져오기 (디버깅 출력 추가)
api_key = os.getenv('OPENAI_API_KEY')
print(f"🔑 API Key loaded: {api_key[:20] if api_key else 'NOT FOUND'}...")

if not api_key:
    raise Exception("OPENAI_API_KEY not found in environment variables")

# OpenAI 클라이언트 초기화
client = OpenAI(api_key=api_key)

def extract_text_from_image(base64_image):
    """
    OpenAI Vision API로 이미지에서 독일어 텍스트 추출
    """
    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": "이 이미지에 있는 독일어 텍스트를 정확히 추출해주세요. 텍스트만 반환하고, 설명은 하지 마세요."
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
            max_tokens=1000
        )
        
        extracted_text = response.choices[0].message.content
        return extracted_text
        
    except Exception as e:
        raise Exception(f"OCR failed: {str(e)}")