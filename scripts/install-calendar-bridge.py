#!/usr/bin/env python3
"""Добавляет только отмеченный блок моста; остальные настройки nginx не меняет."""
import datetime, pathlib, shutil, subprocess, sys, tempfile, os
source=pathlib.Path(sys.argv[1]).read_text()
start='# BEGIN typikon civil calendar bridge'
end='# END typikon civil calendar bridge'
block=source[source.index(start):source.index(end)+len(end)]+'\n'
site=pathlib.Path('/etc/nginx/snippets/typikon-legacy-locations.conf')
original=site.read_text()
if start in original:
    patched=original[:original.index(start)]+block+original[original.index(end)+len(end):].lstrip('\n')
else: patched=original.rstrip()+'\n\n'+block
backup=pathlib.Path('/var/backups/typikon-calendar-bridge')/datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
backup.mkdir(parents=True,mode=0o700)
shutil.copy2(site,backup/site.name)
def write(contents):
    fd,name=tempfile.mkstemp(prefix='.calendar-',dir=site.parent)
    try:
        with os.fdopen(fd,'w') as out:out.write(contents)
        shutil.copystat(site,name);os.replace(name,site)
    finally:
        if os.path.exists(name):os.unlink(name)
write(patched)
try:
    subprocess.run(['nginx','-t'],check=True)
    subprocess.run(['systemctl','reload','nginx'],check=True)
except Exception:
    write(original)
    subprocess.run(['nginx','-t'],check=True)
    subprocess.run(['systemctl','reload','nginx'],check=True)
    raise
print('Календарный мост установлен; резервная копия:',backup)
