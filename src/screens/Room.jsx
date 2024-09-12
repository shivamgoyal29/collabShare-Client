import React, { useEffect, useCallback, useState } from "react";
import ReactPlayer from "react-player";
import peer from "../service/peer";
import { useSocket } from "../context/SocketProvider";
import { useNavigate } from "react-router-dom";

const RoomPage = () => {
  const socket = useSocket();
  const navigate = useNavigate();
  const [remoteSocketId, setRemoteSocketId] = useState(null);
  const [remoteEmail, setRemoteEmail] = useState(""); // State for remote user's email
  const [myStream, setMyStream] = useState();
  const [remoteStream, setRemoteStream] = useState();
  const [streamSent, setStreamSent] = useState(false);

  // Handle when a user joins the room
  const handleUserJoined = useCallback(({ email, id }) => {
    console.log(`Email ${email} joined room`);
    setRemoteSocketId(id);
    setRemoteEmail(email); // Save the email of the remote user
  }, []);

  const handleCallUser = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });
    const offer = await peer.getOffer();
    socket.emit("user:call", { to: remoteSocketId, offer });
    setMyStream(stream);
  }, [remoteSocketId, socket]);

  // Handle when an incoming call is received
  const handleIncommingCall = useCallback(
    async ({ from, offer, email }) => {
      setRemoteSocketId(from);
      setRemoteEmail(email); // Save the email of the remote user
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
      setMyStream(stream);
      console.log(`Incoming Call`, from, offer);
      const ans = await peer.getAnswer(offer);
      socket.emit("call:accepted", { to: from, ans });
    },
    [socket]
  );

  const sendStreams = useCallback(() => {
    for (const track of myStream.getTracks()) {
      peer.peer.addTrack(track, myStream);
    }
    setStreamSent(true);
  }, [myStream]);

  const handleLeaveCall = useCallback(() => {
    myStream.getTracks().forEach((track) => track.stop());
    setMyStream(null);
    setRemoteStream(null);
    setStreamSent(false);
    setRemoteSocketId(null);
    socket.emit("user:leave", { to: remoteSocketId });

    navigate("/");
  }, [myStream, remoteSocketId, socket, navigate]);

  const handleCallAccepted = useCallback(
    ({ from, ans }) => {
      peer.setLocalDescription(ans);
      console.log("Call Accepted!");
      sendStreams();
    },
    [sendStreams]
  );

  const handleNegoNeeded = useCallback(async () => {
    const offer = await peer.getOffer();
    socket.emit("peer:nego:needed", { offer, to: remoteSocketId });
  }, [remoteSocketId, socket]);

  useEffect(() => {
    peer.peer.addEventListener("negotiationneeded", handleNegoNeeded);
    return () => {
      peer.peer.removeEventListener("negotiationneeded", handleNegoNeeded);
    };
  }, [handleNegoNeeded]);

  const handleNegoNeedIncomming = useCallback(
    async ({ from, offer }) => {
      const ans = await peer.getAnswer(offer);
      socket.emit("peer:nego:done", { to: from, ans });
    },
    [socket]
  );

  const handleNegoNeedFinal = useCallback(async ({ ans }) => {
    await peer.setLocalDescription(ans);
  }, []);

  useEffect(() => {
    peer.peer.addEventListener("track", async (ev) => {
      const remoteStream = ev.streams;
      console.log("GOT TRACKS!!");
      setRemoteStream(remoteStream[0]);
    });
  }, []);

  // Handle when the other user leaves
  const handleUserLeave = useCallback(() => {
    console.log("Remote user left the room");
    setRemoteStream(null);
    setRemoteSocketId(null);
    setStreamSent(false);
  }, []);

  useEffect(() => {
    socket.on("user:joined", handleUserJoined);
    socket.on("incomming:call", handleIncommingCall);
    socket.on("call:accepted", handleCallAccepted);
    socket.on("peer:nego:needed", handleNegoNeedIncomming);
    socket.on("peer:nego:final", handleNegoNeedFinal);
    socket.on("user:leave", handleUserLeave);

    return () => {
      socket.off("user:joined", handleUserJoined);
      socket.off("incomming:call", handleIncommingCall);
      socket.off("call:accepted", handleCallAccepted);
      socket.off("peer:nego:needed", handleNegoNeedIncomming);
      socket.off("peer:nego:final", handleNegoNeedFinal);
      socket.off("user:leave", handleUserLeave);
    };
  }, [
    socket,
    handleUserJoined,
    handleIncommingCall,
    handleCallAccepted,
    handleNegoNeedIncomming,
    handleNegoNeedFinal,
    handleUserLeave,
  ]);

  return (
    <div className="h-screen w-screen bg-gray-900 flex flex-col items-center justify-center">
      <div className="relative w-full h-full grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
        {myStream && (
          <div className="relative">
            <h1 className="absolute top-2 left-2 text-white text-lg font-semibold">
              My Stream
            </h1>
            <ReactPlayer
              playing
              muted
              className="rounded-lg overflow-hidden border-2 border-gray-700"
              width="100%"
              height="100%"
              url={myStream}
            />
          </div>
        )}
        {remoteStream && (
          <div className="relative">
            <h1 className="absolute top-2 left-2 text-white text-lg font-semibold">
              Remote Stream ({remoteEmail}) {/* Display remote user's email */}
            </h1>
            <ReactPlayer
              playing
              className="rounded-lg overflow-hidden border-2 border-gray-700"
              width="100%"
              height="100%"
              url={remoteStream}
            />
          </div>
        )}
      </div>
      <div className="absolute bottom-8 flex space-x-4">
        {myStream && !streamSent && (
          <button
            onClick={sendStreams}
            className="bg-green-500 text-white p-4 rounded-full hover:bg-green-600 focus:outline-none transition"
          >
            Send Stream
          </button>
        )}
        {remoteSocketId && !streamSent && (
          <button
            onClick={handleCallUser}
            className="bg-blue-500 text-white p-4 rounded-full hover:bg-blue-600 focus:outline-none transition"
          >
            CALL
          </button>
        )}
        {streamSent && (
          <button
            onClick={handleLeaveCall}
            className="bg-red-500 text-white p-4 rounded-full hover:bg-red-600 focus:outline-none transition"
          >
            Leave Call
          </button>
        )}
      </div>
      {!remoteSocketId && (
        <h4 className="absolute top-2 text-gray-200 text-xl">
          Waiting for someone to join...
        </h4>
      )}
    </div>
  );
};

export default RoomPage;
