/** Türkçe yerel kurallarıyla büyük harf (ör. i→İ, ı→I, ş→Ş). */
export function trUpper(value: string): string {
    return value.toLocaleUpperCase('tr-TR');
}
