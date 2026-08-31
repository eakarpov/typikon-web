'use client';
import TemplesMap from "@/app/temples/map/TemplesMap";

// Карта одного посвящения — та же карта храмов, только с отбором.
//
// Отдельным ходом её не пишем: сетка, гнёзда и порядок ответов там уже
// разобраны, и вторая копия разошлась бы с первой на первой же правке.
const DedicationMap = ({ dedication }: { dedication: string }) => (
    <TemplesMap dedication={dedication} height="h-[52vh]" />
);

export default DedicationMap;
