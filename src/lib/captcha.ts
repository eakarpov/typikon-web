import captcha from "trek-captcha";
import clientPromise from "@/lib/mongodb";

export const store: { [key: string]: { token: string; buffer: Uint8Array} } = {};

export const generateCaptcha = async (ip: string) => {
    const { token, buffer } = await captcha();

    store[ip] = {
        token,
        buffer,
    };
    // await writeCaptcha({
    //     ip,
    //     token,
    // });

    return buffer;
};

export const readCaptcha = async (ip: string): Promise<any> => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon-util");

        const log = await db
            .collection("captchas")
            .aggregate([
                {
                    $match: {
                        ip,
                    },
                }
            ]).limit(1).toArray();

        return log && log[0];
    } catch (e) {
        console.error(e);
        return e;
    }
};

export const writeCaptcha = async (obj: any): Promise<any> => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon-util");

        const log = await db
            .collection("captchas")
            .aggregate([
                {
                    $match: {
                        ip: obj.ip,
                    },
                }
            ]).limit(1).toArray();

        if (log && log[0]) {
            await db
                .collection("captchas")
                .updateOne( { "_id" : log[0]._id },
                    {
                        $set: {
                            ip: obj.ip,
                            token: obj.token,
                        }
                    });
            return;
        } else {
            await db
                .collection("captchas")
                .insertOne({
                    ip: obj.ip,
                    token: obj.token,
                });
            return;
        }
    } catch (e) {
        console.error(e);
        return e;
    }
};
