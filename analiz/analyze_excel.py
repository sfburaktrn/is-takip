# -*- coding: utf-8 -*-
import pandas as pd
import os
import json

files = [f for f in os.listdir('.') if f.endswith('.xlsx')]
xl = pd.ExcelFile(files[0])

df1 = pd.read_excel(xl, sheet_name='DAMPER LİSTESİ', header=0)

print('='*80)
print('BLUE (Sub-steps) vs BLACK (Main Steps) Column Relationship')
print('='*80)

# Based on analysis, the structure is:
# Blue columns have values: 1 or 0 (or NaN)
# Black columns have values: TAMAMLANDI, BAŞLAMADI, DEVAM EDİYOR

# Let's identify all columns by their value types
sub_step_columns = []
main_step_columns = []
info_columns = ['NO', 'İMALAT NO', 'MÜŞTERİ', 'ARAÇ GELDİ Mİ', 'ARAÇ MARKA', 'MODEL', 'TİP', 'MALZEME CİNSİ', 'M3']

for col in df1.columns:
    if col in info_columns:
        continue
    
    unique_vals = df1[col].dropna().unique()
    # Check if contains string values like TAMAMLANDI
    has_string = any(isinstance(v, str) for v in unique_vals)
    
    if has_string:
        # Check if it's a main step column
        if any('TAMAMLANDI' in str(v) or 'BAŞLAMADI' in str(v) or 'DEVAM' in str(v) for v in unique_vals):
            main_step_columns.append(col)
        else:
            # Other string columns (like KURUM MUAYENESİ with YOK, etc)
            main_step_columns.append(col)
    else:
        sub_step_columns.append(col)

print('\nSub-step columns (Blue - values: 1/0):')
for i, col in enumerate(sub_step_columns):
    print(f'  {i+1}. {col}')

print('\nMain-step columns (Black - values: TAMAMLANDI/BAŞLAMADI/DEVAM EDİYOR):')
for i, col in enumerate(main_step_columns):
    unique_vals = df1[col].dropna().unique()
    print(f'  {i+1}. {col}: {list(unique_vals)[:5]}')

# Now let's figure out the grouping
print('\n' + '='*80)
print('Column Grouping Analysis (Sub-steps -> Main Step)')
print('='*80)

# The structure based on Excel column order:
# 9-13: PLAZMA PROGRAMI, SAC MALZEME KONTROLÜ, PLAZMA KESİM, DAMPER ŞASİ PLAZMA KESİM, PRES BÜKÜM
# 14: KESİM - BÜKÜM (main)

# 15-17: ARAÇ BRAKET, DAMPER ŞASİ, ŞASİ YÜKLEME
# 18: ŞASİ BİTİŞ (main)

# 19-24: MİL ALT KÜTÜK, TABAN, YAN, ÖN GÖĞÜS, ARKA KAPAK, YÜKLEME MALZEMESİ
# 25: ÖN HAZIRLIK (main)

# 26-29: DAMPER KURULMASI, DAMPER KAYNAK, ŞASİ KAPAK-SİPERLİK, YÜKLEME
# 30: MONTAJ (main)

# 31: HİDROLİK (main - no sub-steps)

# 32-33: BOYA HAZIRLIK, BOYA
# 34: BOYA BİTİŞ (main)

# 35-37: ELEKTRİK, HAVA, TAMAMLAMA
# 38: TAMAMLAMA BİTİŞ (main)

# 39: SON KONTROL (sub-step, not main)
# 40: KURUM MUAYENESİ (main)
# 41: DMO MUAYENESİ (main)
# 42: TESLİMAT (main)

groups = [
    {
        'main': 'KESİM - BÜKÜM',
        'sub': ['PLAZMA PROGRAMI', 'SAC MALZEME KONTROLÜ', 'PLAZMA KESİM', 'DAMPER ŞASİ PLAZMA KESİM', 'PRES BÜKÜM']
    },
    {
        'main': 'ŞASİ BİTİŞ',
        'sub': ['ARAÇ BRAKET', 'DAMPER ŞASİ', 'ŞASİ YÜKLEME']
    },
    {
        'main': 'ÖN HAZIRLIK',
        'sub': ['MİL ALT KÜTÜK', 'TABAN', 'YAN', 'ÖN GÖĞÜS', 'ARKA KAPAK', 'YÜKLEME MALZEMESİ']
    },
    {
        'main': 'MONTAJ',
        'sub': ['DAMPER KURULMASI', 'DAMPER KAYNAK', 'ŞASİ\nKAPAK-SİPERLİK', 'YÜKLEME']
    },
    {
        'main': 'HİDROLİK',
        'sub': []
    },
    {
        'main': 'BOYA BİTİŞ',
        'sub': ['BOYA HAZIRLIK', 'BOYA']
    },
    {
        'main': 'TAMAMLAMA BİTİŞ',
        'sub': ['ELEKTRİK', 'HAVA', 'TAMAMLAMA']
    },
    {
        'main': 'SON KONTROL',
        'sub': []
    },
    {
        'main': 'KURUM MUAYENESİ',
        'sub': []
    },
    {
        'main': 'DMO MUAYENESİ',
        'sub': []
    },
    {
        'main': 'TESLİMAT',
        'sub': []
    }
]

print('\nColumn Groups:')
for g in groups:
    print(f"\n{g['main']}:")
    if g['sub']:
        for s in g['sub']:
            print(f"  - {s}")
    else:
        print("  (no sub-steps)")

# Export actual data
print('\n' + '='*80)
print('Exporting actual data to JSON')
print('='*80)

# Get only rows with actual data
data_df = df1[df1['İMALAT NO'].notna()].copy()

# Convert to JSON-friendly format
data_list = []
for idx, row in data_df.iterrows():
    record = {}
    for col in data_df.columns:
        val = row[col]
        if pd.isna(val):
            record[col] = None
        elif isinstance(val, float) and val.is_integer():
            record[col] = int(val)
        else:
            record[col] = val
    data_list.append(record)

with open('damper_data.json', 'w', encoding='utf-8') as f:
    json.dump(data_list, f, ensure_ascii=False, indent=2)

print(f'Exported {len(data_list)} records to damper_data.json')
