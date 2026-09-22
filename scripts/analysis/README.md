# 참가자 분석

행사 후 운영 화면에서 내려받은 참가자 CSV를 정리·집계하고, 차트 이미지와 클릭형 대시보드를 만든다.

```bash
pip install pandas matplotlib openpyxl
python scripts/analysis/analyze.py "<참가자-전체-*.csv>" "<출력 폴더>"
```

출력 폴더에 생기는 것:

| 파일 | 내용 |
|---|---|
| `… 참여 분석.xlsx` | 요약 · 시간대별 · 부스별 · 연령별 · 교차표 시트 + `정리 데이터`(원본 행 + 정규화 열) |
| `01~08_*.png` | 보고서용 차트 (200dpi) |
| `dashboard.html` | 브라우저에서 바로 여는 대시보드. 항목을 클릭해 보고 "이미지로 저장"으로 PNG 내려받기 |
| `dashboard-data.json` | 대시보드에 들어가는 집계값 (개인정보 없음) |

- 참여 건수 = CSV 행 수. 한 사람이 여러 부스를 체험하면 그만큼 센다.
- 수기 예약(`구분=수기 예약`)은 시간 예약으로 합쳐 집계한다. 현장에서 적은 명단이므로 전원 도착으로 본다.
- `dashboard-template.html`이 대시보드 원본이고, `analyze.py`가 집계 JSON을 주입해 `dashboard.html`을 만든다. 디자인을 고치려면 템플릿을 수정하고 다시 실행.
- `out/`은 개인정보가 섞일 수 있어 커밋하지 않는다 (`.gitignore`).
