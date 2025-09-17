"use client";

import React from "react";

const TextNote = ({ value, hash }: { value: string; hash?: string|null }) =>
    `#note_${value}` === hash ? (
        <span
            id={`#note_${value}`}
            className="font-bold cursor-pointer"
        >Зри: </span>
    ) : null;

export default TextNote;