import logging
import os
import shutil
from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask

from src.workbench.schemas import TimelineRequest
from src.workbench.service import WorkbenchService

router = APIRouter(
    prefix="/api/workbench",
    tags=["workbench"],
)

logger = logging.getLogger(__name__)

def cleanup_temp_dir(path: str):
    try:
        shutil.rmtree(path)
        logger.info(f"Cleaned up temp dir: {path}")
    except Exception as e:
        logger.error(f"Failed to cleanup temp dir {path}: {e}")

@router.post("/render")
async def render_timeline(
    request: TimelineRequest,
    service: WorkbenchService = Depends()
):
    video_path, temp_dir = await service.render_timeline(request)
    
    return FileResponse(
        video_path,
        media_type="video/mp4",
        filename="export.mp4",
        background=BackgroundTask(cleanup_temp_dir, temp_dir)
    )
