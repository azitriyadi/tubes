<?php
class BaseController {
    protected function sendResponse($status, $message, $data = null) {
        echo json_encode([
            'status' => $status,
            'message' => $message,
            'data' => $data
        ]);
        exit;
    }

    protected function getRequestData() {
        $data = json_decode(file_get_contents("php://input"), true);
        if (!$data) $data = $_POST;
        return $data;
    }
}
?>
