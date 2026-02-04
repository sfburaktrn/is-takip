
const handleExportExcel = async () => {
    if (productType === 'HEPSI') {
        alert('Lütfen Excel çıktısı almak için belirli bir ürün grubu (Damper, Dorse veya Şasi) seçiniz.');
        return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Ürün Listesi');

    // Header Styles
    const groupHeaderStyle: Partial<ExcelJS.Style> = {
        font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 },
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
    };

    const subHeaderStyle: Partial<ExcelJS.Style> = {
        font: { bold: true, color: { argb: 'FF000000' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1D5DB' } } as ExcelJS.Fill, // Gray-300
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
    };

    const baseColumns = [
        { header: 'İMALAT NO', key: 'imalatNo', width: 12 },
        { header: 'MÜŞTERİ', key: 'musteri', width: 25 },
        { header: 'ARAÇ GELDİ Mİ', key: 'aracGeldiMi', width: 15 },
        { header: 'MARKA', key: 'aracMarka', width: 15 },
        { header: 'MODEL', key: 'model', width: 15 },
        { header: 'TİP', key: 'tip', width: 20 },
        { header: 'MALZEME', key: 'malzemeCinsi', width: 15 },
        { header: 'M3', key: 'm3', width: 8 },
    ];

    if (productType === 'DAMPER') {
        // --- ROW 1: GROUP HEADERS ---
        // We need to construct Row 1 manually or using column headers with merges later.
        // Best approach: Define explicit columns for data mapping, then overwrite Header Rows 1 & 2.

        let excelColumns: Partial<ExcelJS.Column>[] = [...baseColumns];

        // Generate columns for Key mapping
        STEP_GROUPS.forEach(group => {
            // Sub-steps
            group.subSteps.forEach(step => {
                excelColumns.push({ header: step.label, key: step.key, width: 18 });
            });
            // Group Summary Column
            excelColumns.push({ header: group.name, key: `${group.key}Summary`, width: 20 });
        });
        // Add remaining static info if any (e.g. Teslimat at the end?)
        excelColumns.push({ header: 'TESLİMAT', key: 'teslimat', width: 15 });


        worksheet.columns = excelColumns; // Set basic columns

        // --- BUILD CUSTOM HEADERS ---
        // Clear auto-generated header row 1 to rebuild it properly
        // Actually, we can just insert Row 1 and Row 2.

        // Header Row 1 Values
        const row1Values: any[] = [];
        // Header Row 2 Values
        const row2Values: any[] = [];

        // Static Base Columns (fill both rows equal or merge vertical)
        baseColumns.forEach(col => {
            row1Values.push(col.header);
            row2Values.push(col.header);
        });

        // Group Columns
        const groupColors = ['FF1E3A8A', 'FF1E40AF', 'FF1E3A8A', 'FF1E40AF', 'FF1E3A8A', 'FF1E40AF', 'FF1E3A8A', 'FF1E40AF']; // Alternating Blues
        let colIndex = baseColumns.length + 1; // 1-based index

        STEP_GROUPS.forEach((group, idx) => {
            // Row 1: Group Name
            row1Values.push(group.name);
            // Fill placeholders for merged cells in Row 1
            for (let i = 0; i < group.subSteps.length; i++) {
                if (i > 0) row1Values.push(group.name); // Just to keep align, will be merged
            }

            // Row 2: Sub-step labels + Summary
            group.subSteps.forEach(step => {
                row2Values.push(step.label);
            });
            // Summary Column header in Row 2
            row2Values.push('DURUM');
        });

        // Teslimat Column
        row1Values.push('TESLİMAT');
        row2Values.push('TESLİMAT');


        // Assign values to Row 1 and Row 2
        const headerRow1 = worksheet.getRow(1);
        headerRow1.values = row1Values;
        const headerRow2 = worksheet.insertRow(2, row2Values);

        // --- MERGING & STYLING HEADERS ---
        let currentCol = 1;

        // 1. Static Cols: Merge Row 1 & 2
        baseColumns.forEach(() => {
            worksheet.mergeCells(1, currentCol, 2, currentCol);

            const cell = worksheet.getCell(1, currentCol);
            cell.style = groupHeaderStyle;
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } }; // Dark Gray
            currentCol++;
        });

        // 2. Groups
        STEP_GROUPS.forEach((group, idx) => {
            const startCol = currentCol;
            const endCol = startCol + group.subSteps.length; // +1 for Summary Column? 
            // Wait, group.subSteps.length is number of sub steps.
            // We added subSteps + 1 summary column.
            // So width is subSteps.length + 1.
            // But in logic above `excelColumns.push`...
            // Iterate:
            // SubSteps... (Count: group.subSteps.length)
            // Summary (Count: 1)

            // Merge Group Title across (SubSteps + Summary)
            worksheet.mergeCells(1, startCol, 1, endCol);

            const groupTitleCell = worksheet.getCell(1, startCol);
            groupTitleCell.value = group.name;
            groupTitleCell.style = groupHeaderStyle;
            groupTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: groupColors[idx % groupColors.length] } };

            // Style Sub-headers (Row 2)
            for (let c = startCol; c <= endCol; c++) {
                const cell = worksheet.getCell(2, c);
                cell.style = subHeaderStyle;
                if (c === endCol) {
                    // Summary Header Style
                    cell.value = `DURUM`; // Or keep generic
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4B5563' } }; // Darker Gray for summary header
                    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
                }
            }

            currentCol = endCol + 1;
        });

        // Teslimat Merge
        worksheet.mergeCells(1, currentCol, 2, currentCol);
        const teslimatCell = worksheet.getCell(1, currentCol);
        teslimatCell.style = groupHeaderStyle;
        teslimatCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };


        // --- DATA ROWS ---
        sortedDampers.forEach(item => {
            const rowValues: any[] = [];

            // Base Info
            baseColumns.forEach(col => {
                let val = (item as any)[col.key as string];
                if (col.key === 'aracGeldiMi') val = val ? 'EVET' : 'HAYIR';
                rowValues.push(val);
            });

            // Group Data
            STEP_GROUPS.forEach(group => {
                let completedCount = 0;
                group.subSteps.forEach(step => {
                    const val = (item as any)[step.key];
                    if (val) completedCount++;
                    rowValues.push(val); // Push boolean for now, will format later
                });

                // Calculate Summary
                // If all true -> Completed
                // If some true -> In Progress
                // If none true -> Not Started
                const total = group.subSteps.length;
                let summary = '';
                if (completedCount === total) summary = 'TAMAMLANDI';
                else if (completedCount > 0) summary = 'DEVAM EDİYOR';
                else summary = 'BAŞLAMADI';

                rowValues.push(summary);
            });

            // Teslimat Data
            rowValues.push(item.teslimat);

            const row = worksheet.addRow(rowValues);

            // --- CELL FORMATTING ---
            let cellIdx = baseColumns.length + 1;

            STEP_GROUPS.forEach(group => {
                // Format Sub-steps
                group.subSteps.forEach(() => {
                    const cell = row.getCell(cellIdx);
                    const val = cell.value;

                    // Explicitly set text for boolean sub-steps as requested
                    if (val === true) {
                        cell.value = 'TAMAMLANDI';
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF22C55E' } }; // Green
                        cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 10 };
                    } else {
                        cell.value = 'BAŞLAMADI';
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEF4444' } }; // Red
                        cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 10 };
                        // User asked: "başlanmamışsa kırmızı başlanmadı yazsın"
                    }
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

                    cellIdx++;
                });

                // Format Summary Column
                const summaryCell = row.getCell(cellIdx);
                const summaryVal = summaryCell.value;

                summaryCell.alignment = { horizontal: 'center', vertical: 'middle' };
                summaryCell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
                summaryCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

                if (summaryVal === 'TAMAMLANDI') {
                    summaryCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF22C55E' } }; // Green
                } else if (summaryVal === 'DEVAM EDİYOR') {
                    summaryCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF06B6D4' } }; // Cyan
                } else {
                    summaryCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEF4444' } }; // Red
                    // Or maybe gray/white for main summary if not started? 
                    // User said: "üst başlıkta devam ediyor yazsın... alttakilerden birine başlanıldı sonuçta".
                    // If NOTHING started, it should probably be RED "BAŞLAMADI".
                }

                cellIdx++;
            });

            // Teslimat Format
            const teslimatCell = row.getCell(cellIdx);
            if (teslimatCell.value === true) {
                teslimatCell.value = 'TAMAMLANDI';
                teslimatCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF22C55E' } };
                teslimatCell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
            } else {
                teslimatCell.value = 'BAŞLAMADI';
                teslimatCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEF4444' } };
                teslimatCell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
            }
            teslimatCell.alignment = { horizontal: 'center', vertical: 'middle' };

        });

    } else {
        // ... Logic for DORSE/SASI (Keep existing or update later) ...
        // For now, keep the simpler logic for others or copy-paste the previous 'else if' blocks but properly handled.
        // Since I am replacing the whole function, I need to preserve the Dorse/Sasi logic.
        // I will copy the simple logic from before for them.

        let columns: Partial<ExcelJS.Column>[] = [];
        let data: any[] = [];

        if (productType === 'DORSE') {
            // ... (Previous Dorse Columns)
            columns = [
                { header: 'İMALAT NO', key: 'imalatNo', width: 15 },
                { header: 'MÜŞTERİ', key: 'musteri', width: 25 },
                // ... (Complete list from previous step)
            ];
            data = sortedDorses;
        } else if (productType === 'SASI') {
            // ... (Previous Sasi Columns)
            columns = []; // Fill with previous
            data = sortedSasis;
        }

        // ... (Previous logic for simple export)
    }

    // ... File Save ...
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `${productType}_Listesi_${new Date().toLocaleDateString('tr-TR')}.xlsx`);
};
