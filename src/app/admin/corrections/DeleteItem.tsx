'use client';

import { ICorrection } from "@/types/dto/corrections";

const DeleteItem = ({ item }: { item: ICorrection }) => {
    const onDelete = () => {
        // Ручки удаления правок нет: кнопка заведена наперёд и пока ничего не делает.
    };

    return (
        <div onClick={onDelete}>
            Удалить
        </div>
    );
};

export default DeleteItem;