<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $nombre = htmlspecialchars($_POST["nombre"]);
    $apellidos = htmlspecialchars($_POST["apellidos"]);
    $email = filter_var($_POST["email"], FILTER_SANITIZE_EMAIL);
    $telefono = htmlspecialchars($_POST["telefono"]);
    $mensaje = htmlspecialchars($_POST["mensaje"]);

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        echo "Correo inválido.";
        exit;
    }

    $para = "gustavo.herraiz@gmail.com";
    $asunto = "Nuevo mensaje de contacto";
    $cuerpo = "Nombre: $nombre\nApellidos: $apellidos\nCorreo: $email\nTeléfono: $telefono\nMensaje:\n$mensaje";

    $cabeceras = "From: $email\r\n";
    $cabeceras .= "Reply-To: $email\r\n";
    $cabeceras .= "Content-Type: text/plain; charset=UTF-8\r\n";

    if (mail($para, $asunto, $cuerpo, $cabeceras)) {
        header("Location: http://www.bladecorporation.net/");
        exit();
    } else {
        echo "Error al enviar el mensaje.";
    }
} else {
    echo "Método no permitido.";
}
?>
