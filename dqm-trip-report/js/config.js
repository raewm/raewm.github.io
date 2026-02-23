// config.js
// This file contains configuration strings that can be modified by users 
// without needing to touch the core application logic.

// Note: Strings are enclosed in backticks (` `) rather than standard quotes
// so that you can hit 'Enter' and make actual line breaks without breaking the file formatting.
window.methodTemplates = {
    'hopper': `Draghead Depth Check -A marked tape or calibrated pressure sensor is attached to the draghead at the elevation of the draghead heel (or with a measured offset from the heel) and the head is lowered to 3 depths at which the DQM display is compared to the tape or sensor and the difference recorded.

Draft Check -Drafts are checked by comparing the onboard DQM display values for forward and aft draft to the physical draft marks located on the vessel hull. This process is performed with the hopper both light and loaded to ensure correct sensor operation across the working range.

Hull Status Check -Hull status is checked by having a crew member operate the hull opening mechanism and recording a picture when the hull switch first signals open. The hull mechanism is then closed and another picture taken when the hull switch first signals closed.

Static GPS Check -Static GPS is checked by comparing the position displayed on the onboard DQM display to the position shown ona team member's handheld GPS.

Ullage -The ullage reading on the onboard DQM display is compared to a physical reading taken by lowering a weighted tape measure into the hopper to measure from the material surface to the coaming.`,
    'scow': `Draft Check - Drafts are checked by comparing the onboard DQM display values for forward and aft draft to the physical draft marks located on the vessel hull. This process is performed with the scow both light and loaded to ensure correct sensor operation across the working range.

Simulated Draft Check - Drafts are checked by comparing the onboard DQM display values for forward and aft draft to the physical draft marks located on the vessel hull. This process is performed with the scow both light and loaded to ensure correct sensor operation across the working range.

Hull Status Check - Hull status is checked by having a crew member operate the hull opening mechanism and recording a picture when the hull switch first signals open. The hull mechanism is then closed and another picture taken when the hull switch first signals closed.

Static GPS Check - Static GPS is checked by comparing the position displayed on the onboard DQM display to the position shown on a team member's handheld GPS. 

Dynamic GPS Check - A team member's handheld GPS is attached to the scow and a track is recorded when the scow sent to the disposal site or otherwise moved a significant distance. The recorded track is then plotted along with the system provider's recorded track for comparison of position, heading and recording interval.

Ullage (if applicable) - The ullage reading on the onboard DQM display is compared to a physical reading taken by lowering a weighted tape measure into the hopper to measure from the material surface to the coaming. In some cases it is more practical to perform this test by lowering a plate under the sensor to simulate material.`,
    'pipeline': `Cutterhead Depth Check -A marked tape or calibrated pressure sensor is attached to the cutterhead at the elevation of the suction mouth (or with a measured offset from the suction mouth) and the head is lowered to 3 depths at which the DQM display is compared to the tape or sensor and the difference recorded.

Velocity Check -The dredge system is stabilized pumping water and a colored dye is injected into the system. The time is carefully measured from the dye injection until dye is seen at the outfall location. This time and the length of pipe are used to calculate the velocity of flow and compared to the DQM displayed velocity. Alternatively a clamp on velocity instrument may be used to determine velocity if dye injection is not possible.

Cutterhead Position Check -Position of the cutterhead is checked by comparing the position displayed on the onboard DQM display to the position shown on a team member's handheld GPS when next to the cutterhead (on platform or boat)

Outfall Position Check -Position of the outfall is checked by comparing the position displayed on the onboard DQM display to the position shown on a team member's handheld GPS when next to the outfall.

Density Verification -Onboard DQM display of density monitored when transitioning from pumping water to material to verify expected behavior.`,
    'mechanical': `Standard language pending.`
};
