"""축제 참가자 CSV → 정리 데이터 엑셀 + 집계 차트(PNG) + 대시보드용 JSON.

사용법: python scripts/analysis/analyze.py <참가자 CSV> <출력 폴더>
  CSV는 운영 화면에서 내려받은 '참가자-전체-*.csv' 형식(수기 합본 포함).
  필요 패키지: pandas, matplotlib, openpyxl
  결과: 참여 분석.xlsx(집계 시트 + 정리 데이터), 01~08 차트 PNG, dashboard-data.json(집계값만, 개인정보 없음)
"""
import re, os, sys, json
import pandas as pd, numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import rcParams

sys.stdout.reconfigure(encoding='utf-8')
if len(sys.argv) < 3:
    sys.exit(__doc__)
SRC, OUT_DIR = sys.argv[1], sys.argv[2]
os.makedirs(OUT_DIR, exist_ok=True)
OUT_XLSX = os.path.join(OUT_DIR, '2026 창의융합보드게임대축제 참여 분석.xlsx')

# ---------- 팔레트 (dataviz 기본 팔레트, light 모드) ----------
SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100']
SEQ = ['#cde2fb', '#b7d3f6', '#9ec5f4', '#86b6ef', '#6da7ec', '#5598e7', '#3987e5', '#2a78d6', '#256abf', '#1c5cab', '#184f95', '#104281', '#0d366b']
INK, INK2, MUTED, GRID, AXIS, SURF = '#0b0b0b', '#52514e', '#898781', '#e1e0d9', '#c3c2b7', '#fcfcfb'
rcParams.update({'font.family': 'Malgun Gothic', 'axes.unicode_minus': False, 'font.size': 11,
                 'axes.edgecolor': AXIS, 'axes.labelcolor': INK2, 'xtick.color': MUTED, 'ytick.color': MUTED,
                 'axes.spines.top': False, 'axes.spines.right': False, 'figure.facecolor': SURF, 'axes.facecolor': SURF,
                 'axes.titleweight': 'bold', 'axes.titlecolor': INK, 'axes.titlesize': 14, 'axes.titlelocation': 'left'})
from matplotlib.colors import LinearSegmentedColormap
CMAP = LinearSegmentedColormap.from_list('seqblue', ['#fcfcfb'] + SEQ)

# ---------- STEP 1. 데이터 정리 ----------
df = pd.read_csv(SRC, dtype=str, keep_default_na=False)
print('STEP 1  원본 행 수:', len(df))

def norm_age(s):
    s = s.strip()
    if not s: return ''
    m = re.search(r'유치\s*(\d)', s)
    if m: return f'유치 {m.group(1)}세'
    m = re.fullmatch(r'(\d)\s*(?:살|세)', s)
    if m: return f'유치 {m.group(1)}세'
    m = re.search(r'(\d)\s*학년', s)
    if m: return f'초등 {m.group(1)}학년'
    m = re.fullmatch(r'(\d+)', s)
    if m:
        n = int(m.group(1))
        return f'초등 {n}학년' if 1 <= n <= 6 else f'유치 {n}세' if n == 7 else ''
    return ''
def age_group(a):
    if a.startswith('유치'): return '유치부'
    m = re.search(r'(\d)학년', a)
    if not m: return '미기재'
    g = int(m.group(1))
    return '초1~2' if g <= 2 else '초3~4' if g <= 4 else '초5~6'
# 참여 시간대: 예약은 예약한 체험 시간(도착 확인이 시작 ±10분에 찍혀 실제 참여 시간과 같음),
# 현장 등록은 부스에서 등록한 시각. 단 운영 시작 전(9시 전)·점심시간(12~13시)에 줄 서서 미리 등록한 경우는
# 실제 체험이 운영 재개 시각에 이뤄졌으므로 09:00 / 13:00으로 옮긴다.
OPEN_AM, LUNCH_START, OPEN_PM = 9 * 60, 12 * 60, 13 * 60
def timeslot(r):
    if r['체험 시간']: return r['체험 시간'][:5]
    t = r['신청 시각'][11:16]
    if not t: return ''
    m = int(t[:2]) * 60 + int(t[3:])
    if m < OPEN_AM: m = OPEN_AM
    elif LUNCH_START <= m < OPEN_PM: m = OPEN_PM
    return f'{m // 60:02d}:{"00" if m % 60 < 30 else "30"}'

df['학년·나이(정리)'] = df['학년·나이'].map(norm_age)
# 정확한 학년 없이 구간만 적힌 값('초1~2' 등)은 연령 구간에만 반영
df['연령 구간'] = [age_group(a) if a else (raw.strip() if raw.strip() in ('초1~2', '초3~4', '초5~6', '유치부') else '미기재') for a, raw in zip(df['학년·나이(정리)'], df['학년·나이'])]
df['시간대'] = df.apply(timeslot, axis=1)
df['참가 유형'] = df['구분'].map({'현장 등록': '현장 등록(자유체험)', '시간 예약': '시간 예약', '수기 예약': '시간 예약'})
df['부스'] = df['부스 번호'].astype(int).map(lambda n: f'{n:02d}') + '. ' + df['부스 이름'].str.replace(r'^\[.*?\]\s*', '', regex=True).str.slice(0, 22)
df['부스 대상'] = df['부스 이름'].str.extract(r'^\[(.*?)\]')[0].fillna('전체').str.replace(', 자유체험', '')
df['참가자ID'] = np.where(df['연락처'] != '', df['이름'] + '|' + df['연락처'], '')
df['시간 구분'] = df['시간대'].map(lambda t: '오전' if t and t < '12:30' else '오후' if t else '미상')
booth_order = sorted(df['부스'].unique())
age_order = [f'유치 {i}세' for i in range(3, 8)] + [f'초등 {i}학년' for i in range(1, 7)]
grp_order = ['유치부', '초1~2', '초3~4', '초5~6', '미기재']
slot_order = [f'{h:02d}:{m}' for h in range(8, 17) for m in ('00', '30')]
slot_order = [s for s in slot_order if s in set(df['시간대'])]

print('  학년 미기재:', (df['학년·나이(정리)'] == '').sum(), '건 (그중 연령 구간만 있음', ((df['학년·나이(정리)'] == '') & (df['연령 구간'] != '미기재')).sum(), '건)')
print('  시간대 부여 실패:', (df['시간대'] == '').sum(), '건')

# ---------- STEP 2. 집계 ----------
N = len(df)
t_slot = df.pivot_table(index='시간대', columns='참가 유형', values='이름', aggfunc='count', fill_value=0).reindex(slot_order).fillna(0).astype(int)
t_slot['합계'] = t_slot.sum(axis=1)
t_slot['비율(%)'] = (t_slot['합계'] / N * 100).round(1)

t_booth = df.groupby(['부스', '부스 대상']).agg(참여건수=('이름', 'count'), 고유참가자=('참가자ID', lambda s: s[s != ''].nunique())).reset_index()
t_booth['비율(%)'] = (t_booth['참여건수'] / N * 100).round(1)
t_booth = t_booth.sort_values('참여건수', ascending=False)

t_age = df[df['학년·나이(정리)'] != ''].groupby('학년·나이(정리)').size().reindex(age_order).fillna(0).astype(int).rename('참여건수').reset_index()
t_age['비율(%)'] = (t_age['참여건수'] / N * 100).round(1)
t_grp = df.groupby('연령 구간').size().reindex(grp_order).fillna(0).astype(int).rename('참여건수').reset_index()
t_grp['비율(%)'] = (t_grp['참여건수'] / N * 100).round(1)
t_gender = df.groupby('성별').size().rename('참여건수').reset_index().replace({'성별': {'': '미기재'}})

x_booth_age = df.pivot_table(index='부스', columns='연령 구간', values='이름', aggfunc='count', fill_value=0).reindex(index=booth_order, columns=grp_order).fillna(0).astype(int)
x_booth_slot = df.pivot_table(index='부스', columns='시간대', values='이름', aggfunc='count', fill_value=0).reindex(index=booth_order, columns=slot_order).fillna(0).astype(int)
x_grp_slot = df.pivot_table(index='연령 구간', columns='시간대', values='이름', aggfunc='count', fill_value=0).reindex(index=grp_order, columns=slot_order).fillna(0).astype(int)

per = df[df['참가자ID'] != ''].groupby('참가자ID').agg(체험부스수=('부스', 'nunique'), 참여건수=('이름', 'count'))
t_type = df.groupby('참가 유형').size().rename('참여건수').reset_index()
t_type['비율(%)'] = (t_type['참여건수'] / N * 100).round(1)

summary = pd.DataFrame([
    ['총 참여 건수', N],
    ['고유 참가자 수(이름+연락처 기준)', int((df['참가자ID'] != '').sum() and df.loc[df['참가자ID'] != '', '참가자ID'].nunique())],
    ['보호자 연락처 수(가족 단위)', df.loc[df['연락처'] != '', '연락처'].nunique()],
    ['운영 부스 수', df['부스'].nunique()],
    ['피크 시간대', f"{t_slot['합계'].idxmax()} ({t_slot['합계'].max()}건)"],
    ['최다 참여 부스', f"{t_booth.iloc[0]['부스']} ({t_booth.iloc[0]['참여건수']}건)"],
    ['최다 연령', f"{t_age.sort_values('참여건수').iloc[-1]['학년·나이(정리)']} ({t_age['참여건수'].max()}건)"],
], columns=['지표', '값'])
print('STEP 2  집계 완료'); print(summary.to_string(index=False))

with pd.ExcelWriter(OUT_XLSX, engine='openpyxl') as xw:
    summary.to_excel(xw, sheet_name='요약', index=False)
    t_slot.reset_index().to_excel(xw, sheet_name='시간대별', index=False)
    t_booth.to_excel(xw, sheet_name='부스별', index=False)
    t_age.to_excel(xw, sheet_name='연령별', index=False)
    t_grp.to_excel(xw, sheet_name='연령구간별', index=False)
    t_type.to_excel(xw, sheet_name='참가유형별', index=False)
    t_gender.to_excel(xw, sheet_name='성별', index=False)
    x_booth_age.reset_index().to_excel(xw, sheet_name='부스x연령구간', index=False)
    x_booth_slot.reset_index().to_excel(xw, sheet_name='부스x시간대', index=False)
    x_grp_slot.reset_index().to_excel(xw, sheet_name='연령구간x시간대', index=False)
    df.to_excel(xw, sheet_name='정리 데이터', index=False)
    for ws in xw.book.worksheets:
        for col in ws.columns:
            w = max(len(str(c.value or '')) for c in col)
            ws.column_dimensions[col[0].column_letter].width = min(max(8, w * 1.6), 60)
        ws.freeze_panes = 'A2'
print('  저장:', OUT_XLSX)

# ---------- STEP 3. 차트 ----------
def save(fig, name):
    p = os.path.join(OUT_DIR, name); fig.savefig(p, dpi=200, bbox_inches='tight', facecolor=SURF); plt.close(fig); print('  차트:', name)
def style(ax, ygrid=True):
    ax.grid(axis='y' if ygrid else 'x', color=GRID, linewidth=0.8); ax.set_axisbelow(True)
    ax.tick_params(length=0)
def bar_labels(ax, bars, fmt='{:,}', fs=9, color=INK2, pad=3, horiz=False):
    for b in bars:
        v = b.get_width() if horiz else b.get_height()
        if v <= 0: continue
        if horiz: ax.text(v + pad, b.get_y() + b.get_height() / 2, fmt.format(int(v)), va='center', ha='left', fontsize=fs, color=color)
        else: ax.text(b.get_x() + b.get_width() / 2, v + pad, fmt.format(int(v)), ha='center', va='bottom', fontsize=fs, color=color)

# 1. 시간대별 (참가 유형 누적)
fig, ax = plt.subplots(figsize=(11, 5.2))
types = ['현장 등록(자유체험)', '시간 예약']
bottom = np.zeros(len(t_slot)); x = np.arange(len(t_slot))
for i, t in enumerate(types):
    v = t_slot[t].values if t in t_slot else np.zeros(len(t_slot))
    ax.bar(x, v, 0.62, bottom=bottom, color=SERIES[i], label=t, edgecolor=SURF, linewidth=1.5); bottom += v
for xi, tot in zip(x, t_slot['합계']): ax.text(xi, tot + 4, f'{tot:,}', ha='center', fontsize=9.5, color=INK)
ax.set_xticks(x); ax.set_xticklabels(t_slot.index); style(ax)
ax.set_title('시간대별 참여 건수'); ax.set_ylabel('참여 건수'); ax.set_xlabel('참여 시간대 (30분 단위 · 점심시간 12:00~13:00 운영 없음)')
ax.legend(frameon=False, loc='upper left', fontsize=9.5)
save(fig, '01_시간대별_참여건수.png')

# 2. 부스별 (가로)
fig, ax = plt.subplots(figsize=(11, 6.5))
tb = t_booth.sort_values('참여건수')
cols = [SERIES[0] if '예약' not in str(t) else SERIES[1] for t in tb['부스 대상']]
res_booths = set(df.loc[df['구분'] != '현장 등록', '부스'])
cols = [SERIES[1] if b in res_booths else SERIES[0] for b in tb['부스']]
bars = ax.barh(tb['부스'], tb['참여건수'], 0.66, color=cols)
bar_labels(ax, bars, horiz=True)
ax.set_title('부스별 참여 건수'); ax.set_xlabel('참여 건수'); style(ax, ygrid=False)
from matplotlib.patches import Patch
ax.legend(handles=[Patch(color=SERIES[0], label='현장 등록(자유체험)'), Patch(color=SERIES[1], label='시간 예약')], frameon=False, loc='lower right')
save(fig, '02_부스별_참여건수.png')

# 3. 연령별
fig, ax = plt.subplots(figsize=(11, 5))
cols = [SERIES[2] if a.startswith('유치') else SERIES[0] for a in t_age['학년·나이(정리)']]
bars = ax.bar(t_age['학년·나이(정리)'].str.replace(' ', chr(10)), t_age['참여건수'], 0.62, color=cols); bar_labels(ax, bars)
ax.set_title('연령별 참여 건수'); ax.set_ylabel('참여 건수'); style(ax)
ax.legend(handles=[Patch(color=SERIES[2], label='유치부'), Patch(color=SERIES[0], label='초등')], frameon=False)
miss = int((df['학년·나이(정리)'] == '').sum())
ax.text(1, 1.02, f'연령 미기재 {miss}건 제외', transform=ax.transAxes, ha='right', fontsize=9, color=MUTED)
save(fig, '03_연령별_참여건수.png')

# 4. 연령 구간 도넛 + 참가 유형 도넛
fig, axes = plt.subplots(1, 2, figsize=(11, 5.6))
for ax, (tab, key, title, pal) in zip(axes, [(t_grp[t_grp['연령 구간'] != '미기재'], '연령 구간', '연령 구간별 비율', [SERIES[2], SERIES[0], '#5598e7', '#184f95']),
                                          (t_type, '참가 유형', '참가 유형별 비율', SERIES[:2])]):
    w, _ = ax.pie(tab['참여건수'], colors=pal, startangle=90, counterclock=False, wedgeprops=dict(width=0.38, edgecolor=SURF, linewidth=2))
    tot = tab['참여건수'].sum()
    ax.text(0, 0, f'{tot:,}건', ha='center', va='center', fontsize=15, fontweight='bold', color=INK)
    ax.legend(w, [f'{k}  {v:,}건 ({v / tot * 100:.0f}%)' for k, v in zip(tab[key], tab['참여건수'])], frameon=False, loc='upper center', bbox_to_anchor=(0.5, 0.0), ncol=2, fontsize=9.5)
    ax.set_title(title)
save(fig, '04_연령구간_참가유형_비율.png')

# 5. 부스 × 연령 구간 히트맵
def heatmap(mat, title, name, fs=(11, 6.5), fmt='{:d}', xlabel=''):
    fig, ax = plt.subplots(figsize=fs)
    im = ax.imshow(mat.values, cmap=CMAP, aspect='auto', vmin=0)
    ax.set_xticks(range(mat.shape[1])); ax.set_xticklabels(mat.columns, rotation=0 if mat.shape[1] < 8 else 45, ha='center' if mat.shape[1] < 8 else 'right', fontsize=9)
    ax.set_yticks(range(mat.shape[0])); ax.set_yticklabels(mat.index, fontsize=9.5)
    vmax = mat.values.max()
    for i in range(mat.shape[0]):
        for j in range(mat.shape[1]):
            v = mat.values[i, j]
            if v: ax.text(j, i, fmt.format(v), ha='center', va='center', fontsize=8.5, color='#ffffff' if v > vmax * 0.55 else INK2)
    ax.set_title(title); ax.tick_params(length=0); ax.set_xlabel(xlabel)
    for s in ax.spines.values(): s.set_visible(False)
    save(fig, name)
heatmap(x_booth_age.drop(columns='미기재'), '부스 × 연령 구간 참여 건수', '05_부스x연령구간_히트맵.png')
heatmap(x_booth_slot, '부스 × 시간대 참여 건수', '06_부스x시간대_히트맵.png', fs=(13, 6.5))
heatmap(x_grp_slot.drop(index='미기재'), '연령 구간 × 시간대 참여 건수', '07_연령구간x시간대_히트맵.png', fs=(12, 3.8))

# 8. 성별 × 연령 구간
gx = df[df['성별'].isin(['남', '여'])].pivot_table(index='연령 구간', columns='성별', values='이름', aggfunc='count', fill_value=0).reindex(grp_order[:-1])
fig, ax = plt.subplots(figsize=(9, 4.6)); x = np.arange(len(gx)); w = 0.36
b1 = ax.bar(x - w / 2, gx['남'], w, color=SERIES[0], label='남'); b2 = ax.bar(x + w / 2, gx['여'], w, color=SERIES[1], label='여')
bar_labels(ax, b1); bar_labels(ax, b2)
ax.set_xticks(x); ax.set_xticklabels(gx.index); ax.set_title('연령 구간 × 성별 참여 건수'); ax.set_ylabel('참여 건수'); style(ax); ax.legend(frameon=False)
save(fig, '08_연령구간x성별.png')

# ---------- STEP 4. 대시보드용 JSON ----------
# 행 단위로 내보내되 이름·연락처는 빼고 참가자는 익명 번호(pid)로만 표시. 대시보드가 분류/부스 필터를 걸어 직접 집계한다.
booth_info = df.groupby('부스').agg(target=('부스 대상', 'first'), cat=('체험 분류', 'first'), reserved=('구분', lambda s: bool((s != '현장 등록').any()))).reindex(booth_order)
dims = {
    'booths': [{'name': b, 'target': r['target'], 'cat': r['cat'], 'reserved': bool(r['reserved'])} for b, r in booth_info.iterrows()],
    'cats': sorted(df['체험 분류'].unique()),
    'slots': slot_order,
    'ages': age_order,
    'groups': grp_order[:-1],
    'genders': ['남', '여'],
    'types': types,
}
idx = {k: {v: i for i, v in enumerate(vals)} for k, vals in dims.items() if k != 'booths'}
idx['booths'] = {b['name']: i for i, b in enumerate(dims['booths'])}
pid_map = {p: i for i, p in enumerate(sorted(df.loc[df['참가자ID'] != '', '참가자ID'].unique()))}
rows_out = []
for i, r in df.iterrows():
    rows_out.append([idx['booths'][r['부스']], idx['cats'][r['체험 분류']], idx['slots'][r['시간대']],
                     idx['ages'].get(r['학년·나이(정리)'], -1), idx['groups'].get(r['연령 구간'], -1), idx['genders'].get(r['성별'], -1), idx['types'][r['참가 유형']],
                     pid_map.get(r['참가자ID'], -1)])
data = {'meta': {'source': os.path.basename(SRC), 'families': int(df.loc[df['연락처'] != '', '연락처'].nunique())}, 'dims': dims, 'rows': rows_out}
with open(os.path.join(OUT_DIR, 'dashboard-data.json'), 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=1)
print('STEP 4  dashboard-data.json 저장')

# ---------- STEP 5. 대시보드 HTML (템플릿에 집계 JSON 주입) ----------
tpl_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'dashboard-template.html')
with open(tpl_path, encoding='utf-8') as f:
    html = f.read().replace('/*__DATA__*/null', json.dumps(data, ensure_ascii=False))
vendor = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'vendor')
for mark, name in (('/*__CHARTJS__*/', 'chart-4.4.1.umd.js'), ('/*__HTML2CANVAS__*/', 'html2canvas-1.4.1.min.js')):
    with open(os.path.join(vendor, name), encoding='utf-8') as f:
        html = html.replace(mark, f.read(), 1)
with open(os.path.join(OUT_DIR, 'dashboard.html'), 'w', encoding='utf-8') as f:
    f.write(html)
print('STEP 5  dashboard.html 저장 (브라우저에서 열면 됨)')
print('완료 →', OUT_DIR)
