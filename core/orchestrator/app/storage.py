# SPDX-License-Identifier: Apache-2.0
import hashlib
import io
import socket
import struct
from fastapi import HTTPException
from . import config

ALLOWED_TYPES = {'application/pdf','image/png','image/jpeg','text/plain'}
ALLOWED_EXT = {'.pdf','.png','.jpg','.jpeg','.txt'}


def validate_file(filename, content_type, data):
    from pathlib import Path
    if not filename or Path(filename).suffix.lower() not in ALLOWED_EXT or content_type not in ALLOWED_TYPES:
        raise HTTPException(422, 'Chỉ nhận PDF, PNG, JPG hoặc TXT')
    if not data or len(data) > config.MAX_FILE_SIZE:
        raise HTTPException(422, 'Tệp trống hoặc lớn hơn 5 MB')
    if content_type == 'application/pdf' and not data.startswith(b'%PDF-'):
        raise HTTPException(422, 'Nội dung không phải PDF hợp lệ')
    if content_type == 'image/png' and not data.startswith(b'\x89PNG\r\n\x1a\n'):
        raise HTTPException(422, 'Nội dung không phải PNG')
    if content_type == 'image/jpeg' and not data.startswith(b'\xff\xd8'):
        raise HTTPException(422, 'Nội dung không phải JPEG')
    return hashlib.sha256(data).hexdigest()


def clamav_scan(data):
    if not config.CLAMAV_HOST:
        raise HTTPException(503, 'Chưa có bộ quét mã độc: không cho phép nhận hồ sơ online')
    try:
        with socket.create_connection((config.CLAMAV_HOST,3310), timeout=10) as conn:
            conn.sendall(b'zINSTREAM\0')
            for pos in range(0,len(data),8192):
                part=data[pos:pos+8192]
                conn.sendall(struct.pack('!I',len(part)) + part)
            conn.sendall(struct.pack('!I',0))
            reply=conn.recv(1024)
            if b'OK' not in reply: raise HTTPException(422, 'Tệp không vượt qua bước quét mã độc')
    except HTTPException: raise
    except OSError:
        raise HTTPException(503, 'Không thể kết nối ClamAV: từ chối tệp')


def s3():
    import boto3
    return boto3.client('s3', endpoint_url=config.S3_ENDPOINT,aws_access_key_id=config.S3_ACCESS_KEY,
                        aws_secret_access_key=config.S3_SECRET_KEY,region_name='us-east-1')


def save_object(key, data, content_type):
    if config.STORAGE_MODE == 's3':
        client=s3()
        try: client.head_bucket(Bucket=config.S3_BUCKET)
        except Exception: client.create_bucket(Bucket=config.S3_BUCKET)
        client.put_object(Bucket=config.S3_BUCKET,Key=key,Body=data,ContentType=content_type)
    else:
        path=config.STORAGE_DIR / key
        path.parent.mkdir(parents=True,exist_ok=True)
        path.write_bytes(data)


def get_object(key):
    if config.STORAGE_MODE == 's3':
        return s3().get_object(Bucket=config.S3_BUCKET, Key=key)['Body'].read()
    path=config.STORAGE_DIR / key
    if not path.is_file(): raise HTTPException(404, 'Tệp không tồn tại')
    return path.read_bytes()
