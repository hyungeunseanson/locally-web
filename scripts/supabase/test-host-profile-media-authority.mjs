import {PGlite} from '@electric-sql/pglite';
import {setupHostDatabase,runHostScenario} from '../../tests/integration/host-profile-media.scenario.mjs';
const db=new PGlite();try{await setupHostDatabase(db);await runHostScenario(db);}finally{await db.close();}
