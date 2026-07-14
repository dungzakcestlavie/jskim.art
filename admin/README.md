# jskim.art local-helper (Phase 1)

브라우저 Admin(정적 HTML)은 GitHub에 직접 쓸 수 없고 써서도 안 됩니다.
이 helper는 등작의 PC에서만 실행되는 로컬 서버로, 이미지 처리 · works.json 저장 ·
git commit/push를 대신 수행합니다. GitHub 토큰은 이 코드 어디에도 없습니다 —
Windows의 Git Credential Manager(또는 SSH 키)가 이미 설정되어 있다는 전제로,
평소 터미널에서 `git push`가 되는 상태라면 이 helper의 push도 동일하게 동작합니다.

## 설치 (최초 1회)

1. 두 저장소를 로컬에 clone 합니다.
   ```
   git clone https://github.com/dungzakcestlavie/jskim.art.git
   git clone https://github.com/dungzakcestlavie/jskim-images.git
   ```
2. Python 3.10+ 설치 확인: `python --version`
3. 이 폴더에서 의존성 설치:
   ```
   pip install -r requirements.txt
   ```
4. `.env.example` 을 `.env` 로 복사 후, 위 1번에서 clone한 두 폴더의 실제 경로로 수정합니다.

## 실행

```
python server.py
```

`http://127.0.0.1:8420` 에서 대기합니다. (admin.js의 helperUrl과 일치)

Admin 화면은 jskim.art 저장소 폴더에서 정적 서버로 엽니다:
```
cd jskim.art
python -m http.server 8000
```
그다음 브라우저에서 `http://localhost:8000/admin/` 접속.

## 매 작업 세션마다

1. `python server.py` 실행 (helper)
2. 정적 서버 실행 (admin 화면)
3. Admin에서 작품 등록 → "등록 전 검토" → "이미지 처리 + works.json 저장"
4. 결과 확인 후 "GitHub에 반영 (git push)" 클릭 — 이 단계는 별도 버튼으로 분리되어 있어
   저장과 실제 배포를 혼동하지 않습니다.

## 안전장치

- works.json 저장 전 자동 백업 (`works.json.bak.YYYYMMDDHHMMSS`) 생성, 쓰기 실패 시 자동 복구
- 작품 ID 중복, 이미지 파일명 중복은 서버에서도 재검사
- 업스케일 금지 (원본보다 큰 해상도로 늘리지 않음)
- EXIF 방향 자동 보정
- git push는 로컬에 변경사항이 있을 때만 커밋하며, push 실패 시 에러를 그대로 반환 (자동 재시도 없음)

## Phase 2 (다음 단계, 미구현)

- 일괄 등록 (여러 작품 동시 처리)
- Admin에서 섹션 추가/수정/비활성화
- JPEG vs WebP 실측 비교 후 포맷 결정
- GitHub Actions를 이용한 자동 검증(존재하지 않는 이미지 참조, 중복 ID 등)
