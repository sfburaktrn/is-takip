
const handleExportExcel = async () => {
    if (productType === 'HEPSI') {
        alert('Lütfen Excel çıktısı almak için belirli bir ürün grubu (Damper, Dorse veya Şasi) seçiniz.');
        return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Ürün Listesi');

    // Common Header Style
    const headerStyle = {
        font: { bold: true, color: { argb: 'FFFFFFFF' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } } as ExcelJS.Fill,
        alignment: { horizontal: 'center', vertical: 'middle' } as Partial<ExcelJS.Alignment>
    };

    let columns: Partial<ExcelJS.Column>[] = [];
    let data: any[] = [];

    if (productType === 'DAMPER') {
        columns = [
            { header: 'İMALAT NO', key: 'imalatNo', width: 15 },
            { header: 'MÜŞTERİ', key: 'musteri', width: 25 },
            { header: 'ARAÇ GELDİ Mİ', key: 'aracGeldiMi', width: 15 },
            { header: 'MARKA', key: 'aracMarka', width: 15 },
            { header: 'MODEL', key: 'model', width: 15 },
            { header: 'TİP', key: 'tip', width: 20 },
            { header: 'MALZEME', key: 'malzemeCinsi', width: 15 },
            { header: 'M3', key: 'm3', width: 10 },
            // Production Steps
            { header: 'PLAZMA PROGRAMI', key: 'plazmaProgrami', width: 18 },
            { header: 'SAC KONTROL', key: 'sacMalzemeKontrolu', width: 15 },
            { header: 'PLAZMA KESİM', key: 'plazmaKesim', width: 15 },
            { header: 'ŞASİ PLAZMA', key: 'damperSasiPlazmaKesim', width: 15 },
            { header: 'PRES BÜKÜM', key: 'presBukum', width: 15 },
            { header: 'ARAÇ BRAKET', key: 'aracBraket', width: 15 },
            { header: 'DAMPER ŞASİ', key: 'damperSasi', width: 15 },
            { header: 'ŞASİ YÜKLEME', key: 'sasiYukleme', width: 15 },
            { header: 'MİL ALT KÜTÜK', key: 'milAltKutuk', width: 15 },
            { header: 'TABAN', key: 'taban', width: 10 },
            { header: 'YAN', key: 'yan', width: 10 },
            { header: 'ÖN GÖĞÜS', key: 'onGogus', width: 15 },
            { header: 'ARKA KAPAK', key: 'arkaKapak', width: 15 },
            { header: 'İLAVE', key: 'yuklemeMalzemesi', width: 10 },
            { header: 'KURULMA', key: 'damperKurulmasi', width: 15 },
            { header: 'KAYNAK', key: 'damperKaynak', width: 15 },
            { header: 'SİPERLİK', key: 'sasiKapakSiperlik', width: 15 },
            { header: 'YÜKLEME', key: 'yukleme', width: 15 },
            { header: 'HİDROLİK', key: 'hidrolik', width: 15 },
            { header: 'BOYA HAZIRLIK', key: 'boyaHazirlik', width: 18 },
            { header: 'BOYA', key: 'boya', width: 10 },
            { header: 'ELEKTRİK', key: 'elektrik', width: 15 },
            { header: 'HAVA', key: 'hava', width: 10 },
            { header: 'TAMAMLAMA', key: 'tamamlama', width: 15 },
            { header: 'SON KONTROL', key: 'sonKontrol', width: 15 },
            { header: 'TESLİMAT', key: 'teslimat', width: 15 }
        ];
        data = sortedDampers;
    } else if (productType === 'DORSE') {
        columns = [
            { header: 'İMALAT NO', key: 'imalatNo', width: 15 },
            { header: 'MÜŞTERİ', key: 'musteri', width: 25 },
            { header: 'ÇEKİCİ GELDİ Mİ', key: 'cekiciGeldiMi', width: 18 },
            { header: 'DİNGİL', key: 'dingil', width: 15 },
            { header: 'LASTİK', key: 'lastik', width: 15 },
            { header: 'TAMPON', key: 'tampon', width: 15 },
            { header: 'KALINLIK', key: 'kalinlik', width: 15 },
            { header: 'M3', key: 'm3', width: 10 },
            { header: 'PLAZMA PROGRAMI', key: 'plazmaProgrami', width: 18 },
            { header: 'SAC KONTROL', key: 'sacMalzemeKontrolu', width: 15 },
            { header: 'PLAZMA KESİM', key: 'plazmaKesim', width: 15 },
            { header: 'PRES BÜKÜM', key: 'presBukum', width: 15 },
            { header: 'DORSE ŞASİ', key: 'dorseSasi', width: 15 },
            { header: 'MİL KÜTÜK', key: 'milAltKutuk', width: 15 },
            { header: 'TABAN', key: 'taban', width: 10 },
            { header: 'YAN', key: 'yan', width: 10 },
            { header: 'ÖN GÖĞÜS', key: 'onGogus', width: 15 },
            { header: 'ARKA KAPAK', key: 'arkaKapak', width: 15 },
            { header: 'İLAVE', key: 'yuklemeMalzemesi', width: 10 },
            { header: 'KURULMA', key: 'dorseKurulmasi', width: 15 },
            { header: 'KAYNAK', key: 'dorseKaynak', width: 15 },
            { header: 'SİPERLİK', key: 'kapakSiperlik', width: 15 },
            { header: 'YÜKLEME', key: 'yukleme', width: 15 },
            { header: 'HİDROLİK', key: 'hidrolik', width: 15 },
            { header: 'BOYA HAZIRLIK', key: 'boyaHazirlik', width: 18 },
            { header: 'ŞASİ BOYAMA', key: 'dorseSasiBoyama', width: 15 },
            { header: 'ÇEKİCİ ELEKTRİK', key: 'cekiciElektrik', width: 18 },
            { header: 'ÇEKİCİ HİDROLİK', key: 'cekiciHidrolik', width: 18 },
            { header: 'FREN', key: 'fren', width: 10 },
            { header: 'ELEKTRİK', key: 'dorseElektrik', width: 15 },
            { header: 'TAMAMLAMA', key: 'tamamlama', width: 15 },
            { header: 'BYPASS', key: 'aracKontrolBypassAyari', width: 15 },
            { header: 'SON KONTROL', key: 'sonKontrol', width: 15 },
            { header: 'TİP ONAY', key: 'tipOnay', width: 15 },
            { header: 'FATURA', key: 'fatura', width: 15 },
            { header: 'TAHSİLAT', key: 'tahsilat', width: 15 },
            { header: 'TESLİMAT', key: 'teslimat', width: 15 }
        ];
        data = sortedDorses;
    } else if (productType === 'SASI') {
        columns = [
            { header: 'İMALAT NO', key: 'imalatNo', width: 15 },
            { header: 'MÜŞTERİ', key: 'musteri', width: 25 },
            { header: 'ŞASİ NO', key: 'sasiNo', width: 20 },
            { header: 'TAMPON', key: 'tampon', width: 15 },
            { header: 'DİNGİL', key: 'dingil', width: 15 },
            { header: 'ŞASİ AYARI', key: 'sasiAyari', width: 15 },
            { header: 'MONTAJ', key: 'montaj', width: 15 },
            { header: 'KAYNAK', key: 'kaynak', width: 15 },
            { header: 'KAYNAK SONRASI', key: 'kaynakSonrasi', width: 18 },
            { header: 'ASTAR PÜTÜR', key: 'boyaAstarPutur', width: 15 },
            { header: 'BOYA', key: 'boya', width: 10 },
            { header: 'MONTAJ', key: 'montaj', width: 15 },
            { header: 'TESLİMAT', key: 'teslimat', width: 15 }
        ];
        data = sortedSasis;
    }

    worksheet.columns = columns;

    // Apply styles to header
    worksheet.getRow(1).eachCell((cell) => {
        cell.font = headerStyle.font;
        cell.fill = headerStyle.fill;
        cell.alignment = headerStyle.alignment;
    });

    // Add Data and Style Cells
    data.forEach((item) => {
        const row = worksheet.addRow(item);

        // Conditional Formatting for Status Columns (Boolean fields)
        row.eachCell((cell, colNumber) => {
            const columnKey = columns[colNumber - 1]?.key as string;

            // Skip non-boolean info columns for coloring
            const infoColumns = ['imalatNo', 'musteri', 'aracMarka', 'model', 'tip', 'malzemeCinsi', 'm3', 'dingil', 'lastik', 'tampon', 'kalinlik', 'sasiNo'];

            if (!infoColumns.includes(columnKey)) {
                const value = item[columnKey];

                if (value === true) {
                    cell.value = 'TAMAMLANDI';
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FF22C55E' } // Green
                    };
                    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
                    cell.alignment = { horizontal: 'center' };
                } else if (value === false || value === null || value === undefined) {
                    // Optional: Leave blank or specific color for not started
                    // If explicitly 'false' (step exists but not done)
                    // Currently most are boolean, false means not done.
                }

                // Handle Special Cases like 'aracGeldiMi' which is boolean but maybe we want "EVET"/"HAYIR"
                if (columnKey === 'aracGeldiMi' || columnKey === 'cekiciGeldiMi') {
                    cell.value = value ? 'EVET' : 'HAYIR';
                    cell.fill = undefined; // Reset fill for these info-like booleans or keep plain
                    cell.font = { color: { argb: 'FF000000' } };
                }
            }
        });
    });

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `${productType}_Listesi_${new Date().toLocaleDateString('tr-TR')}.xlsx`);
};
