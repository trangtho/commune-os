# SPDX-License-Identifier: Apache-2.0
"""Optional Flowable REST adapter. PostgreSQL state machine remains canonical for demo.

Only the linear review -> decision -> delivery BPMN path is implemented. Advanced DMN,
parallel gateways and process migration are still backlog items.
"""
import requests
from fastapi import HTTPException
from . import config

def call(method,path,**kwargs):
    if not config.FLOWABLE_ENABLED:return None
    try:
        resp=requests.request(method,config.FLOWABLE_URL+path,
            auth=(config.FLOWABLE_USER,config.FLOWABLE_PASSWORD),timeout=12,**kwargs)
        resp.raise_for_status()
        return resp.json() if resp.content else {}
    except requests.RequestException as exc:
        raise HTTPException(502,'Flowable unavailable; business transaction was not committed') from exc

def ensure_deployed(code, bpmn_xml):
    if not config.FLOWABLE_ENABLED:return
    key=code.replace('-','_')
    found=call('GET','/repository/process-definitions',params={'key':key,'latest':'true'})
    if found and found.get('total',0):return
    if not bpmn_xml:raise HTTPException(503,'BPMN payload missing for procedure')
    call('POST','/repository/deployments',files={'file':(code+'.bpmn20.xml',bpmn_xml.encode(),'text/xml')},
        data={'deploymentName':'communeos-'+key})

def start(procedure_code,dossier_id,bpmn_xml):
    if not config.FLOWABLE_ENABLED:return None
    ensure_deployed(procedure_code,bpmn_xml)
    response=call('POST','/runtime/process-instances',json={
        'processDefinitionKey':procedure_code.replace('-','_'),
        'businessKey':dossier_id,'variables':[{'name':'dossierId','value':dossier_id}]})
    return response.get('id')

def complete(process_id,action):
    if not process_id or not config.FLOWABLE_ENABLED:return
    tasks=call('GET','/runtime/tasks',params={'processInstanceId':process_id}).get('data',[])
    if not tasks:raise HTTPException(409,'No active Flowable task')
    call('POST',f"/runtime/tasks/{tasks[0]['id']}",json={'action':'complete',
        'variables':[{'name':'decision','value':action}]})
