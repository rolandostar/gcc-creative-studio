from typing import List, Literal, Optional
from pydantic import BaseModel

class Clip(BaseModel):
    assetId: str
    url: str
    startTime: float
    duration: float
    offset: float
    trackIndex: int
    type: Literal['video', 'audio']

class TimelineRequest(BaseModel):
    clips: List[Clip]
    output_format: str = "mp4"
    width: Optional[int] = 1920
    height: Optional[int] = 1080
