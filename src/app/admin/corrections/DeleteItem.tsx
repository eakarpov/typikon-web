'use client';

import { ICorrection } from "@/types/dto/corrections";

const DeleteItem = ({ item }: { item: ICorrection }) => {
    const onDelete = () => {
        console.log(item);
    };

    return (
        <div onClick={onDelete}>
            Удалить
        </div>
    );
};

export default DeleteItem;