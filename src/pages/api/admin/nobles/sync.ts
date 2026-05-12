import {NextApiRequest, NextApiResponse} from "next";
import {init} from "@/lib/sqlite";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (!process.env.SHOW_ADMIN) {
        res.status(404).end();
        return;
    }
    if (req.method === 'POST') {
        try {
            const db = await init();

            await db.exec(`CREATE TABLE if not exists nobles (
                id INTEGER primary key AUTOINCREMENT,
                name TEXT,
                englishName TEXT,
                originalName TEXT,
                birthDate TEXT,
                deathDate TEXT,
                isSaintOrthodox INTEGER,
                isSaintCatholic INTEGER,
                gender INTEGER,
                links TEXT,
                surnames TEXT,
                info TEXT,
                csName TEXT,
                nickName TEXT,
                churchName TEXT,
                rank INTEGER,
                
                birthDateMarker INTEGER,
                deathDateMarker INTEGER,

                defaultNationalityId INTEGER,
                familyId INTEGER,
                fatherId INTEGER,
                motherId INTEGER,
                foreign key (defaultNationalityId) references nationalities(id),
                foreign key (familyId) references families(id),
                foreign key(fatherId) references nobles(id),
                foreign key(motherId) references nobles(id)
            )`);

            await db.exec(`CREATE VIRTUAL TABLE if not exists nobles_text USING FTS5(name, content=nobles)`);

            await db.exec(`
                CREATE TRIGGER if not exists nobles_text_insert AFTER INSERT ON nobles
                BEGIN
                    INSERT INTO nobles_text (rowid, name) VALUES (new.rowid, new.name);
                END;
                
                CREATE TRIGGER if not exists nobles_text_delete AFTER DELETE ON nobles
                BEGIN
                    INSERT INTO nobles_text (nobles_text, rowid, name) VALUES ('delete', old.rowid, old.name);
                END;
                
                CREATE TRIGGER if not exists nobles_text_update AFTER UPDATE ON nobles
                BEGIN
                    INSERT INTO nobles_text (nobles_text, rowid, name) VALUES ('delete', old.rowid, old.name);
                    INSERT INTO nobles_text (rowid, name) VALUES (new.rowid, new.name);
                END
            `);

            // await db.exec(`drop table if exists nobles_text`);

            // await db.exec(`INSERT INTO nobles_text(name) select (name) from nobles`)

            await db.exec(`CREATE TABLE if not exists couples (
                id INTEGER primary key AUTOINCREMENT,
                husbandId INTEGER NOT NULL,
                wifeId INTEGER NOT NULL,
                marriageDate TEXT,
                divorceDate TEXT,
                
                foreign key (husbandId) references nobles(id),
                foreign key (wifeId) references nobles(id)
            )`);

            await db.exec(`CREATE TABLE if not exists states (
                id INTEGER primary key AUTOINCREMENT,
                name TEXT,
                surnames TEXT,
                defaultTitle TEXT,
                predessorId INTEGER,

                foreign key (predessorId) references states(id),
            )`);

            await db.exec(`CREATE VIRTUAL TABLE if not exists states_text USING FTS5(name, content=states)`);

            await db.exec(`
                CREATE TRIGGER if not exists states_text_insert AFTER INSERT ON states
                BEGIN
                    INSERT INTO states_text (rowid, name) VALUES (new.rowid, new.name);
                END;
                
                CREATE TRIGGER if not exists states_text_delete AFTER DELETE ON states
                BEGIN
                    INSERT INTO states_text (states_text, rowid, name) VALUES ('delete', old.rowid, old.name);
                END;
                
                CREATE TRIGGER if not exists states_text_update AFTER UPDATE ON states
                BEGIN
                    INSERT INTO states_text (states_text, rowid, name) VALUES ('delete', old.rowid, old.name);
                    INSERT INTO states_text (rowid, name) VALUES (new.rowid, new.name);
                END
            `);

            await db.exec(`CREATE TABLE if not exists families (
                id INTEGER primary key AUTOINCREMENT,
                name TEXT
            )`);

            await db.exec(`CREATE VIRTUAL TABLE if not exists families_text USING FTS5(name, content=families)`);

            await db.exec(`
                CREATE TRIGGER if not exists families_text_insert AFTER INSERT ON families
                BEGIN
                    INSERT INTO families_text (rowid, name) VALUES (new.rowid, new.name);
                END;
                
                CREATE TRIGGER if not exists families_text_delete AFTER DELETE ON families
                BEGIN
                    INSERT INTO families_text (families_text, rowid, name) VALUES ('delete', old.rowid, old.name);
                END;
                
                CREATE TRIGGER if not exists families_text_update AFTER UPDATE ON families
                BEGIN
                    INSERT INTO families_text (families_text, rowid, name) VALUES ('delete', old.rowid, old.name);
                    INSERT INTO families_text (rowid, name) VALUES (new.rowid, new.name);
                END
            `);

            await db.exec(`CREATE TABLE if not exists nationalities (
                id INTEGER primary key AUTOINCREMENT,
                name TEXT
            )`);

            await db.exec(`CREATE VIRTUAL TABLE if not exists nationalities_text USING FTS5(name, content=nationalities)`);

            await db.exec(`
                CREATE TRIGGER if not exists nationalities_text_insert AFTER INSERT ON nationalities
                BEGIN
                    INSERT INTO nationalities_text (rowid, name) VALUES (new.rowid, new.name);
                END;
                
                CREATE TRIGGER if not exists nationalities_text_delete AFTER DELETE ON nationalities
                BEGIN
                    INSERT INTO nationalities_text (nationalities_text, rowid, name) VALUES ('delete', old.rowid, old.name);
                END;
                
                CREATE TRIGGER if not exists nationalities_text_update AFTER UPDATE ON nationalities
                BEGIN
                    INSERT INTO nationalities_text (nationalities_text, rowid, name) VALUES ('delete', old.rowid, old.name);
                    INSERT INTO nationalities_text (rowid, name) VALUES (new.rowid, new.name);
                END
            `);

            await db.exec(`CREATE TABLE if not exists nationalities_nobles (
                id INTEGER primary key AUTOINCREMENT,
                personId INTEGER NOT NULL,
                nationalityId INTEGER NOT NULL,
                foreign key (personId) references nobles(id),
                foreign key (nationalityId) references nationalities(id)
            )`);

            await db.exec(`CREATE TABLE if not exists rules (
                id INTEGER primary key AUTOINCREMENT,
                stateId INTEGER NOT NULL,
                personId INTEGER NOT NULL,

                predessorId INTEGER,
                heirId INTEGER,
                suzerainId INTEGER,
                regentId INTEGER,

                startDate TEXT,
                endDate TEXT,
                title TEXT,
                regentTitle TEXT,

                foreign key (stateId) references states(id),
                foreign key (suzerainId) references states(id),
    
                foreign key (personId) references nobles(id),
                foreign key (heirId) references nobles(id),
                foreign key (regentId) references nobles(id),

                foreign key (predessorId) references rules(id)
            )`);

            await db.close();

            res.status(200).end();
        } catch (error) {
            console.log(error);
            res.status(400).end();
        }
        return;
    }
    res.status(405).end();
}