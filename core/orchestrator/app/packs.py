# SPDX-License-Identifier: Apache-2.0
import io
import json
import hashlib
import re
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET
import yaml
from fastapi import HTTPException
from sqlalchemy import select
from .models import Procedure
from . import config

NECESSARY = {'pack.yaml','process.bpmn','form.schema.json','checklist.dmn','wiki/huong-dan.md'}

def decode_pack(content:dict[str,bytes]):
    missing=NECESSARY-set(content)
    if missing: raise HTTPException(422, detail={'missing_pack_files': sorted(missing)})
    if any(len(v)>512_000 for v in content.values()): raise HTTPException(422,'Pack file too large')
    try:
        meta=yaml.safe_load(content['pack.yaml'])
        schema=json.loads(content['form.schema.json'])
        ET.fromstring(content['process.bpmn']); ET.fromstring(content['checklist.dmn'])
        assert isinstance(meta,dict) and isinstance(meta['code'],str) and isinstance(meta['version'],str)
        assert re.fullmatch(r'[a-z][a-z0-9-]{1,79}',meta['code'])
        assert re.fullmatch(r'\d+\.\d+\.\d+',meta['version'])
        bpmn=ET.fromstring(content['process.bpmn'])
        processes=[node for node in bpmn.iter() if node.tag.endswith('}process')]
        assert processes and processes[0].get('id')==meta['code'].replace('-','_')
        assert isinstance(meta['required_documents'],list) and isinstance(meta['sla_hours'],int)
        assert 0 < meta['sla_hours'] <= 24*365
        assert all(isinstance(i,dict) and i.get('code') and i.get('name') for i in meta['required_documents'])
        from jsonschema import Draft202012Validator
        Draft202012Validator.check_schema(schema)
        assert schema.get('type') == 'object'
    except (ValueError, KeyError, TypeError, AssertionError, ET.ParseError) as exc:
        raise HTTPException(422,'Pack không hợp lệ: '+str(exc))
    return meta,schema,content['wiki/huong-dan.md'].decode('utf-8')

def import_pack(db, files):
    meta,schema,wiki=decode_pack(files)
    digest=hashlib.sha256(b''.join(name.encode()+b'\0'+files[name] for name in sorted(NECESSARY))).hexdigest()
    existing=db.scalar(select(Procedure).where(Procedure.code==meta['code'],Procedure.version==meta['version']))
    if existing:
        if existing.fingerprint and existing.fingerprint != digest:
            raise HTTPException(409,'Phiên bản đã tồn tại với nội dung khác; hãy tăng version')
        return existing
    existing=Procedure(code=meta['code'], version=meta['version'], name=meta['name'],
             sla_hours=meta['sla_hours'], required_documents=meta['required_documents'],
             form_schema=schema,wiki=wiki,bpmn_xml=files['process.bpmn'].decode(),
             dmn_xml=files['checklist.dmn'].decode(),fingerprint=digest)
    db.add(existing)
    db.flush()
    return existing

def read_directory(path:Path):
    return {str(p.relative_to(path)).replace('\\','/'):p.read_bytes() for p in path.rglob('*') if p.is_file()}

def read_zip(data):
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            names=z.namelist()
            if len(names)>50 or any('..' in Path(n).parts or n.startswith('/') for n in names):
                raise HTTPException(422,'Unsafe pack archive')
            content={n:z.read(n) for n in names if not n.endswith('/')}
            if sum(map(len,content.values()))>3_000_000: raise HTTPException(422,'Pack archive too large')
            return content
    except zipfile.BadZipFile:
        raise HTTPException(422,'Invalid ZIP')

def seed_packs(db):
    for directory in config.PACKS_DIR.iterdir():
        if directory.is_dir() and (directory/'pack.yaml').is_file():
            import_pack(db,read_directory(directory))
