"""add_original_gcs_uris

Revision ID: 0bd50a4bf20c
Revises: 9393a3d298c6
Create Date: 2026-01-29 12:53:26.493393

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0bd50a4bf20c'
down_revision: Union[str, None] = '9393a3d298c6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    
    media_columns = [c['name'] for c in inspector.get_columns('media_items')]
    if 'original_gcs_uris' not in media_columns:
        op.add_column('media_items', sa.Column('original_gcs_uris', sa.ARRAY(sa.String()), nullable=True))
        
    source_columns = [c['name'] for c in inspector.get_columns('source_assets')]
    if 'original_gcs_uri' not in source_columns:
        op.add_column('source_assets', sa.Column('original_gcs_uri', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('source_assets', 'original_gcs_uri')
    op.drop_column('media_items', 'original_gcs_uris')

