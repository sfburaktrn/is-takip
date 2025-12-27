# -*- coding: utf-8 -*-
import pandas as pd
import os
import json

# Find Excel file
files = [f for f in os.listdir('.') if f.endswith('.xlsx')]
if not files:
    # Check parent directory
    files = [f for f in os.listdir('..') if f.endswith('.xlsx')]
    xl = pd.ExcelFile('../' + files[0])
else:
    xl = pd.ExcelFile(files[0])

print('Sheet names:', xl.sheet_names)

# Read ÖZET sheet
df_ozet = pd.read_excel(xl, sheet_name='DAMPER LİSTESİ ÖZET', header=0)

print('\n' + '='*80)
print('DAMPER LİSTESİ ÖZET - Column Analysis')
print('='*80)

print('\nColumns:', list(df_ozet.columns))
print('\nFirst 5 rows:')
print(df_ozet.head())

print('\n' + '='*80)
print('MÜŞTERİ (Customer) Analysis')
print('='*80)

# Get customer column
if 'MÜŞTERİ' in df_ozet.columns:
    customer_col = 'MÜŞTERİ'
else:
    # Find column with customer names
    for col in df_ozet.columns:
        if 'müşteri' in col.lower() or 'musteri' in col.lower():
            customer_col = col
            break

# Get unique customers
customers = df_ozet[customer_col].dropna().unique()
print(f'\nUnique customers ({len(customers)}):')
for c in customers[:20]:
    print(f'  - {c}')

# Analyze customer naming pattern
print('\n' + '='*80)
print('Customer Grouping Pattern')
print('='*80)

# Group by base name (remove numbers and suffixes)
import re

def get_base_company(name):
    """Extract base company name, removing numbers and suffixes"""
    if pd.isna(name):
        return None
    name = str(name).strip().upper()
    # Remove trailing numbers like "1", "2", etc.
    name = re.sub(r'\s*\d+\s*$', '', name)
    # Remove trailing dashes like "EFATUR-1" -> "EFATUR"
    name = re.sub(r'\s*[-_]\s*\d*\s*$', '', name)
    return name.strip()

df_ozet['base_company'] = df_ozet[customer_col].apply(get_base_company)

# Count by base company
company_counts = df_ozet.groupby('base_company').size().sort_values(ascending=False)
print('\nCompany order counts (grouped):')
for company, count in company_counts.items():
    if company:
        variants = df_ozet[df_ozet['base_company'] == company][customer_col].unique()
        print(f'  {company}: {count} orders')
        if len(variants) > 1:
            print(f'    Variants: {list(variants)}')

# Export summary data
print('\n' + '='*80)
print('Creating Company Summary JSON')
print('='*80)

summary_data = []

for base_company in company_counts.index:
    if not base_company:
        continue
    
    company_df = df_ozet[df_ozet['base_company'] == base_company]
    variants = company_df[customer_col].unique().tolist()
    
    summary_data.append({
        'base_company': base_company,
        'total_orders': len(company_df),
        'variants': variants
    })

with open('company_summary.json', 'w', encoding='utf-8') as f:
    json.dump(summary_data, f, ensure_ascii=False, indent=2)

print(f'Exported {len(summary_data)} companies to company_summary.json')

# Print sample data structure
print('\n' + '='*80)
print('Sample data structure:')
print('='*80)
print(json.dumps(summary_data[:3], ensure_ascii=False, indent=2))
