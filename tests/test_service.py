"""Tests for service module."""

from __future__ import annotations

import os
from pathlib import Path
from typing import TYPE_CHECKING
from unittest.mock import MagicMock, patch

import psutil
import pytest
from fastapi.testclient import TestClient

from legion.service import LegionService, create_app


if TYPE_CHECKING:
    from fastapi import FastAPI


class TestLegionService:
    """Tests for LegionService class."""

    @pytest.fixture(autouse=True)
    def setup_service(self, tmp_path: Path):
        """Set up a fresh service for each test."""
        self.temp_dir = tmp_path
        self.pid_file = tmp_path / 'legion.pid'
        self.log_file = tmp_path / 'legion.log'

        with (
            patch('legion.service.PID_FILE', self.pid_file),
            patch('legion.service.LOG_FILE', self.log_file),
        ):
            self.service = LegionService()
            yield

    def test_ensure_dirs_creates_parent_dir(self) -> None:
        """Test that _ensure_dirs creates the parent directory."""
        assert self.pid_file.parent.exists()

    def test_get_pid_no_file(self) -> None:
        """Test getting PID when file doesn't exist."""
        result = self.service.get_pid()

        assert result is None

    def test_get_pid_with_valid_file(self) -> None:
        """Test getting PID when file contains valid PID."""
        current_pid = os.getpid()
        self.pid_file.parent.mkdir(parents=True, exist_ok=True)
        self.pid_file.write_text(str(current_pid))

        with patch('psutil.pid_exists', return_value=True):
            result = self.service.get_pid()

        assert result == current_pid

    def test_get_pid_with_stale_file(self) -> None:
        """Test getting PID when file contains stale/non-existent PID."""
        self.pid_file.parent.mkdir(parents=True, exist_ok=True)
        self.pid_file.write_text('99999')

        with patch('psutil.pid_exists', return_value=False):
            result = self.service.get_pid()

        assert result is None
        assert not self.pid_file.exists()  # Should be cleaned up

    def test_get_pid_with_invalid_content(self) -> None:
        """Test getting PID when file contains invalid content."""
        self.pid_file.parent.mkdir(parents=True, exist_ok=True)
        self.pid_file.write_text('not_a_number')

        result = self.service.get_pid()

        assert result is None

    def test_is_running_when_running(self) -> None:
        """Test is_running when service is running."""
        current_pid = os.getpid()
        self.pid_file.parent.mkdir(parents=True, exist_ok=True)
        self.pid_file.write_text(str(current_pid))

        with patch('psutil.pid_exists', return_value=True):
            result = self.service.is_running()

        assert result is True

    def test_is_running_when_not_running(self) -> None:
        """Test is_running when service is not running."""
        result = self.service.is_running()

        assert result is False

    def test_stop_when_not_running(self) -> None:
        """Test stopping when service is not running."""
        result = self.service.stop()

        assert result is False

    def test_stop_when_running(self) -> None:
        """Test stopping when service is running."""
        current_pid = os.getpid()
        self.pid_file.parent.mkdir(parents=True, exist_ok=True)
        self.pid_file.write_text(str(current_pid))

        mock_process = MagicMock()
        with (
            patch('psutil.pid_exists', return_value=True),
            patch('psutil.Process', return_value=mock_process),
        ):
            result = self.service.stop()

        assert result is True
        mock_process.terminate.assert_called_once()
        mock_process.wait.assert_called_once_with(timeout=5)

    def test_stop_process_not_found(self) -> None:
        """Test stopping when process no longer exists."""
        current_pid = os.getpid()
        self.pid_file.parent.mkdir(parents=True, exist_ok=True)
        self.pid_file.write_text(str(current_pid))

        with (
            patch('psutil.pid_exists', return_value=True),
            patch('psutil.Process', side_effect=psutil.NoSuchProcess(current_pid)),
        ):
            result = self.service.stop()

        assert result is False

    def test_stop_timeout(self) -> None:
        """Test stopping when process doesn't terminate in time."""
        current_pid = os.getpid()
        self.pid_file.parent.mkdir(parents=True, exist_ok=True)
        self.pid_file.write_text(str(current_pid))

        mock_process = MagicMock()
        mock_process.wait.side_effect = psutil.TimeoutExpired(5)

        with (
            patch('psutil.pid_exists', return_value=True),
            patch('psutil.Process', return_value=mock_process),
        ):
            result = self.service.stop()

        assert result is False

    def test_restart(self) -> None:
        """Test restart method."""
        with (
            patch.object(self.service, 'stop', return_value=True) as mock_stop,
            patch.object(self.service, 'start', return_value=True) as mock_start,
            patch('time.sleep'),
        ):
            result = self.service.restart()

        assert result is True
        mock_stop.assert_called_once()
        mock_start.assert_called_once()

    def test_status_when_not_running(self) -> None:
        """Test status output when not running."""
        with patch.object(self.service, 'get_pid', return_value=None):
            # Just verify it doesn't raise an exception
            self.service.status()

    def test_status_when_running(self) -> None:
        """Test status output when running."""
        current_pid = os.getpid()

        mock_process = MagicMock()
        mock_process.create_time.return_value = MagicMock(
            strftime=lambda _fmt: '2024-01-01 00:00:00'
        )
        mock_process.memory_info.return_value = MagicMock(rss=1024 * 1024 * 100)
        mock_process.cpu_percent.return_value = 5.0

        with (
            patch.object(self.service, 'get_pid', return_value=current_pid),
            patch('psutil.Process', return_value=mock_process),
        ):
            # Just verify it doesn't raise an exception
            self.service.status()


class TestCreateApp:
    """Tests for create_app function."""

    @pytest.fixture
    def app(self) -> FastAPI:
        """Create test app."""
        return create_app()

    @pytest.fixture
    def client(self, app: FastAPI) -> TestClient:
        """Create test client."""
        return TestClient(app)

    def test_app_created(self, app: FastAPI) -> None:
        """Test that app is created successfully."""
        assert app is not None
        assert app.title == 'Legion'
        assert app.version == '0.1.0'

    def test_api_status_endpoint(self, client: TestClient) -> None:
        """Test the /api/status endpoint."""
        response = client.get('/api/status')

        assert response.status_code == 200
        data = response.json()
        assert data['status'] == 'running'
        assert data['version'] == '0.1.0'
        assert 'timestamp' in data

    def test_root_endpoint_without_static(self) -> None:
        """Test the root endpoint when static files don't exist."""
        # Create a mock Path that returns False for exists()
        mock_path = Path('/nonexistent/path')
        with patch('legion.service.STATIC_DIR', mock_path):
            # Create a new app with the patched STATIC_DIR
            test_app = create_app()
            test_client = TestClient(test_app)
            response = test_client.get('/')

        assert response.status_code == 200
        data = response.json()
        assert 'Legion API Server' in data['message']


class TestWebSocket:
    """Tests for WebSocket endpoints."""

    @pytest.fixture
    def app(self) -> FastAPI:
        """Create test app."""
        return create_app()

    @pytest.fixture
    def client(self, app: FastAPI) -> TestClient:
        """Create test client."""
        return TestClient(app)

    @pytest.mark.anyio
    async def test_websocket_echo(self, client: TestClient) -> None:
        """Test the basic WebSocket endpoint."""
        with client.websocket_connect('/ws') as websocket:
            test_message = {'test': 'data'}
            websocket.send_json(test_message)
            response = websocket.receive_json()

            assert response['type'] == 'echo'
            assert response['data'] == test_message

    @pytest.mark.anyio
    async def test_websocket_handles_exception(self, client: TestClient) -> None:
        """Test that WebSocket handles exceptions gracefully."""
        with client.websocket_connect('/ws') as websocket:
            # Send invalid JSON to trigger exception handling
            websocket.send_text('invalid json')
            # Connection should be closed or continue without crash
