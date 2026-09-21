# Выкладка сайта: окружение, родословная, пересборка.
#
# Цель задаётся ключом (release-target.sh):
#     npm run release                    # prod
#     npm run release -- --target test
. "$(dirname "$0")/release-target.sh"

put_env
scp_put nobles.db "$REMOTE_ROOT/nobles.db"

#scp_put mongod_dump.sh "$REMOTE_ROOT/mongod_dump.sh"

ssh_run "REMOTE_ROOT='$REMOTE_ROOT' bash -s" < "$RELEASE_DIR/rebuild-remote.sh"
